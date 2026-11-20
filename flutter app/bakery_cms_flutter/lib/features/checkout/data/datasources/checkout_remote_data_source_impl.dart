import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/checkout_product_model.dart';
import '../models/online_payment_status_model.dart';
import '../models/order_confirmation_model.dart';
import '../models/order_request_model.dart';
import '../models/pin_check_model.dart';
import '../models/pin_check_request_model.dart';
import '../models/quote_model.dart';
import '../models/quote_request_model.dart';
import '../models/razorpay_order_model.dart';
import 'checkout_remote_data_source.dart';

class CheckoutRemoteDataSourceImpl implements CheckoutRemoteDataSource {
  const CheckoutRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  @override
  Future<QuoteModel> quote(QuoteRequestModel body) async =>
      QuoteModel.fromJson(_object(await _client.post(ApiEndpoints.quote, body: body.toJson())));

  @override
  Future<PinCheckModel> checkDeliveryPin(PinCheckRequestModel body) async => PinCheckModel.fromJson(
    _object(await _client.post(ApiEndpoints.deliveryPin, body: body.toJson())),
  );

  @override
  Future<RazorpayOrderModel> createRazorpayOrder(String draftId) async =>
      RazorpayOrderModel.fromJson(
        _object(await _client.post(ApiEndpoints.razorpayOrder, body: {'draftId': draftId})),
      );

  @override
  Future<OrderConfirmationModel> placeOrder(OrderRequestModel body) async =>
      OrderConfirmationModel.fromJson(
        _object(await _client.post(ApiEndpoints.orders, body: body.toJson())),
      );

  @override
  Future<OnlinePaymentStatusModel> onlinePaymentStatus() async => OnlinePaymentStatusModel.fromJson(
    _object(await _client.get(ApiEndpoints.razorpayAvailability)),
  );

  @override
  Future<List<CheckoutProductModel>> fetchProducts() async {
    // A legacy route: `{ products: [...] }`, not the envelope.
    final body = await _client.get(ApiEndpoints.products);
    final list = body is Map<String, dynamic> ? body[_productsKey] : null;
    if (list is! List) throw const ServerException();
    return [
      for (final item in list.whereType<Map<String, dynamic>>())
        if (CheckoutProductModel.fromJson(item) case final product
            when product.isPublished && product.slug.isNotEmpty)
          product,
    ];
  }

  @override
  Future<Map<String, String>> fetchOccasionNames() async {
    final data = _object(await _client.get(ApiEndpoints.catalog));
    final occasions = data[_occasionsKey];
    return {
      if (occasions is List)
        for (final row in occasions.whereType<Map<String, dynamic>>())
          if (row[_idKey] case final String id)
            if (row[_nameKey] case final String name) id: name,
    };
  }

  static const String _productsKey = 'products';
  static const String _occasionsKey = 'occasions';
  static const String _idKey = 'id';
  static const String _nameKey = 'name';

  /// A payload that is not an object is a broken answer, not a crash.
  static Map<String, dynamic> _object(Object? payload) =>
      payload is Map<String, dynamic> ? payload : throw const ServerException();
}
