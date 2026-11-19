import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../../../core/network/order_events.dart';
import '../../domain/entities/checkout_catalog.dart';
import '../../domain/entities/order_confirmation.dart';
import '../../domain/entities/order_submission.dart';
import '../../domain/entities/pin_check_request.dart';
import '../../domain/entities/pin_check_result.dart';
import '../../domain/entities/quote.dart';
import '../../domain/entities/quote_request.dart';
import '../../domain/entities/razorpay_order.dart';
import '../../domain/repositories/checkout_repository.dart';
import '../datasources/checkout_remote_data_source.dart';
import '../models/order_request_model.dart';
import '../models/pin_check_request_model.dart';
import '../models/quote_request_model.dart';

class CheckoutRepositoryImpl implements CheckoutRepository {
  const CheckoutRepositoryImpl(this._remote, {OrderEvents? orderEvents})
    : _orderEvents = orderEvents;

  final CheckoutRemoteDataSource _remote;
  final OrderEvents? _orderEvents;

  @override
  Future<Either<Failure, Quote>> quote(QuoteRequest request) =>
      guard(() async => (await _remote.quote(QuoteRequestModel.fromEntity(request))).toEntity());

  @override
  Future<Either<Failure, PinCheckResult>> checkDeliveryPin(PinCheckRequest request) => guard(
    () async =>
        (await _remote.checkDeliveryPin(PinCheckRequestModel.fromEntity(request))).toEntity(),
  );

  @override
  Future<Either<Failure, RazorpayOrder>> createOnlinePayment(String draftId) =>
      guard(() async => (await _remote.createRazorpayOrder(draftId)).toEntity());

  @override
  Future<Either<Failure, OrderConfirmation>> placeOrder(OrderSubmission submission) =>
      guard(() async {
        final placed = (await _remote.placeOrder(
          OrderRequestModel.fromEntity(submission),
        )).toEntity();
        // The order list may already be open in its tab; tell it there is a
        // new order to show.
        _orderEvents?.notifyChanged();
        return placed;
      });

  @override
  Future<Either<Failure, bool?>> onlinePaymentAvailable() =>
      guard(() async => (await _remote.onlinePaymentStatus()).configured);

  @override
  Future<Either<Failure, CheckoutCatalog>> checkoutCatalog() => guard(() async {
    // The names only label the occasion chips: a catalogue that cannot be
    // read leaves them out, never the products (which decide cash on delivery).
    final names = _remote.fetchOccasionNames().then<Map<String, String>>(
      (names) => names,
      onError: (Object _) => const <String, String>{},
    );
    final products = await _remote.fetchProducts();
    final occasionNames = await names;
    return CheckoutCatalog({
      for (final product in products) product.slug: product.toEntity(occasionNames),
    });
  });
}
