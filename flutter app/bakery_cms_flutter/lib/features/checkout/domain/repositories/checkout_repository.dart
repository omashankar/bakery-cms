import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/checkout_catalog.dart';
import '../entities/order_confirmation.dart';
import '../entities/order_submission.dart';
import '../entities/pin_check_request.dart';
import '../entities/pin_check_result.dart';
import '../entities/quote.dart';
import '../entities/quote_request.dart';
import '../entities/razorpay_order.dart';

abstract interface class CheckoutRepository {
  Future<Either<Failure, Quote>> quote(QuoteRequest request);

  Future<Either<Failure, PinCheckResult>> checkDeliveryPin(PinCheckRequest request);

  /// Opens a Razorpay order for the priced draft.
  Future<Either<Failure, RazorpayOrder>> createOnlinePayment(String draftId);

  Future<Either<Failure, OrderConfirmation>> placeOrder(OrderSubmission submission);

  /// Whether the gateway can take a payment now; null when the shop did not
  /// give a clear answer.
  Future<Either<Failure, bool?>> onlinePaymentAvailable();

  /// The published products, with their occasion names, as checkout reads them.
  Future<Either<Failure, CheckoutCatalog>> checkoutCatalog();
}
