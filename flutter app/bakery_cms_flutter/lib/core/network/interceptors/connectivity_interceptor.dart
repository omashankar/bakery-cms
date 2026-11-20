import 'package:dio/dio.dart';

import '../../error/network_exception.dart';
import '../network_info.dart';

/// Refuses a request up front when the device is offline.
class ConnectivityInterceptor extends Interceptor {
  ConnectivityInterceptor(this._networkInfo);

  final NetworkInfo _networkInfo;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (await _networkInfo.isConnected) return handler.next(options);
    handler.reject(
      DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        error: const NetworkException(),
      ),
    );
  }
}
