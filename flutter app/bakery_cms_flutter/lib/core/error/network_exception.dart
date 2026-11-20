import 'app_exception.dart';

class NetworkException extends AppException {
  const NetworkException({this.isTimeout = false});

  final bool isTimeout;
}
