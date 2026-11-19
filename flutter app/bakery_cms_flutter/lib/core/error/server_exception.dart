import 'app_exception.dart';

class ServerException extends AppException {
  const ServerException({String? message, this.statusCode, this.field}) : super(message);

  final int? statusCode;

  /// The form field the shop blamed, e.g. `pincode` or `deliverySlot.date`.
  final String? field;
}
