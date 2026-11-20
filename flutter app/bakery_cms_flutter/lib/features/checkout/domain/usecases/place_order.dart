import 'package:fpdart/fpdart.dart';

import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/error/network_failure.dart';
import '../../../../core/error/server_failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/order_confirmation.dart';
import '../entities/order_submission.dart';
import '../entities/payment_method.dart';
import '../entities/payment_request.dart';
import '../entities/quote.dart';
import '../entities/quote_request.dart';
import '../failures/paid_but_unconfirmed_failure.dart';
import '../failures/payment_unavailable_failure.dart';
import '../failures/price_change_reason.dart';
import '../failures/price_changed_failure.dart';
import '../repositories/checkout_repository.dart';
import '../repositories/payment_gateway.dart';
import 'place_order_params.dart';

/// The whole of "Place order":
///
/// 1. price the cart with the full address (the shop checks the map pin and
///    the slot here, while refusing still costs nothing), and stop with
///    [PriceChangedFailure] if that price is not the one the customer saw;
/// 2. online: open a Razorpay order on that draft and take the payment;
/// 3. place the order against the draft.
///
/// Step 3 is retried, with the same order id, while its outcome is unknown: a
/// dropped connection or a 5xx. The id is the caller's and stays the same
/// across presses, so neither a retry here nor a second press can place the
/// order twice. Once paid, any failure is [PaidButUnconfirmedFailure]: the
/// customer must not pay again.
class PlaceOrder implements UseCase<OrderConfirmation, PlaceOrderParams> {
  const PlaceOrder({
    required CheckoutRepository repository,
    required PaymentGateway gateway,
    this.attempts = 3,
    this.retryDelay = const Duration(seconds: 1),
  }) : _repository = repository,
       _gateway = gateway;

  final CheckoutRepository _repository;
  final PaymentGateway _gateway;
  final int attempts;
  final Duration retryDelay;

  /// Totals within this are the same price (they are doubles).
  static const double _samePrice = 0.009;

  @override
  Future<Either<Failure, OrderConfirmation>> call(PlaceOrderParams params) async {
    final online = params.paymentMethod == PaymentMethod.online;
    if (online && !_gateway.isSupported) return const Left(PaymentUnavailableFailure());

    final quoted = await _repository.quote(
      QuoteRequest(
        items: params.items,
        couponCode: params.couponCode,
        giftWrap: params.giftWrap,
        deliveryTierId: params.slot.tierId,
        address: params.address,
        slot: params.slot,
        orderNotes: params.orderNotes,
        personalisation: params.personalisation,
      ),
    );
    if (quoted case Left(value: final failure)) return Left(failure);
    final quote = quoted.toNullable()!;

    final changed = _priceChange(params, quote);
    if (changed != null) return Left(PriceChangedFailure(quote: quote, reason: changed));

    String? reference;
    if (online) {
      final opened = await _repository.createOnlinePayment(quote.draftId);
      if (opened case Left(value: final failure)) return Left(failure);

      final paid = await _gateway.pay(
        PaymentRequest(
          order: opened.toNullable()!,
          shopName: params.shopName,
          description: CheckoutStrings.paymentDescription,
          name: params.address.fullName,
          email: params.address.email,
          phone: params.address.phone,
        ),
      );
      if (paid case Left(value: final failure)) return Left(failure);
      reference = paid.toNullable()!.paymentId;
    }

    final placed = await _submit(_submission(params, quote, reference));
    if (reference != null) {
      if (placed case Left(value: final failure)) {
        return Left(PaidButUnconfirmedFailure(paymentId: reference, refused: _isRefusal(failure)));
      }
    }
    return placed;
  }

  /// Why the final [quote] is not the price the customer saw, or null.
  PriceChangeReason? _priceChange(PlaceOrderParams params, Quote quote) {
    if (params.couponCode != null && quote.rejectedCoupon != null) {
      return PriceChangeReason.couponRejected;
    }
    final expected = params.expectedTotal;
    if (expected == null) return PriceChangeReason.notShown;
    if ((quote.totals.total - expected).abs() > _samePrice) return PriceChangeReason.totalChanged;
    return null;
  }

  OrderSubmission _submission(PlaceOrderParams params, Quote quote, String? reference) {
    return OrderSubmission(
      id: params.orderId,
      draftId: quote.draftId,
      items: params.items,
      totals: quote.totals,
      address: params.address,
      slot: params.slot,
      paymentMethod: params.paymentMethod,
      paymentReference: reference,
      orderNotes: params.orderNotes,
      personalisation: params.personalisation,
    );
  }

  Future<Either<Failure, OrderConfirmation>> _submit(OrderSubmission submission) async {
    var result = await _repository.placeOrder(submission);
    for (var attempt = 1; attempt < attempts; attempt++) {
      if (result case Left(value: final failure) when _outcomeUnknown(failure)) {
        await Future<void>.delayed(retryDelay * attempt);
        result = await _repository.placeOrder(submission);
      } else {
        break;
      }
    }
    return result;
  }

  /// The order may or may not exist: safe (and needed) to ask again with the
  /// same id.
  static bool _outcomeUnknown(Failure failure) =>
      failure is NetworkFailure || (failure is ServerFailure && failure.isServerError);

  /// The shop answered, and the answer was no (a 4xx).
  static bool _isRefusal(Failure failure) =>
      failure is ServerFailure && !failure.isServerError && failure.statusCode != null;
}
