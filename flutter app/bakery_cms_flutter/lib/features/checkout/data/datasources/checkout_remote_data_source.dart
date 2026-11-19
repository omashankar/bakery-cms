import '../models/checkout_product_model.dart';
import '../models/online_payment_status_model.dart';
import '../models/order_confirmation_model.dart';
import '../models/order_request_model.dart';
import '../models/pin_check_model.dart';
import '../models/pin_check_request_model.dart';
import '../models/quote_model.dart';
import '../models/quote_request_model.dart';
import '../models/razorpay_order_model.dart';

/// The shop's checkout endpoints. Throws the app's typed exceptions.
abstract interface class CheckoutRemoteDataSource {
  Future<QuoteModel> quote(QuoteRequestModel body);

  Future<PinCheckModel> checkDeliveryPin(PinCheckRequestModel body);

  Future<RazorpayOrderModel> createRazorpayOrder(String draftId);

  Future<OrderConfirmationModel> placeOrder(OrderRequestModel body);

  /// `GET /api/razorpay/availability`: can the shop take an online payment?
  Future<OnlinePaymentStatusModel> onlinePaymentStatus();

  /// `GET /api/products`, published products only.
  Future<List<CheckoutProductModel>> fetchProducts();

  /// `GET /api/catalog` → `occasions`: occasion id → name, every occasion.
  Future<Map<String, String>> fetchOccasionNames();
}
