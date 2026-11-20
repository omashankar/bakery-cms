import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart';

import '../constants/api_endpoints.dart';
import '../constants/app_durations.dart';
import 'interceptors/connectivity_interceptor.dart';
import 'interceptors/error_interceptor.dart';
import 'network_info.dart';
import 'session_events.dart';

/// Builds the one Dio instance the app uses.
///
/// The shop signs a customer in with an httpOnly `customer_session` cookie,
/// so the [CookieJar] is what keeps them signed in. A persistent jar means
/// the session survives an app restart, as it does in a browser.
abstract final class DioFactory {
  static Dio create({
    required CookieJar cookieJar,
    required NetworkInfo networkInfo,
    required SessionEvents sessionEvents,
  }) {
    final dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: AppDurations.connectTimeout,
        receiveTimeout: AppDurations.receiveTimeout,
        contentType: Headers.jsonContentType,
        responseType: ResponseType.json,
        headers: const {'Accept': 'application/json'},
      ),
    );

    dio.interceptors.addAll([
      ConnectivityInterceptor(networkInfo),
      CookieManager(cookieJar),
      ErrorInterceptor(sessionEvents),
      if (kDebugMode)
        LogInterceptor(
          requestBody: true,
          responseBody: false,
          logPrint: (line) => debugPrint(line.toString()),
        ),
    ]);
    return dio;
  }
}
