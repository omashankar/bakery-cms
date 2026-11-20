import 'package:dio/dio.dart';

import '../../constants/api_endpoints.dart';
import '../../constants/app_strings.dart';
import '../../error/app_exception.dart';
import '../../error/network_exception.dart';
import '../../error/server_exception.dart';
import '../../error/unauthorized_exception.dart';
import '../api_envelope.dart';
import '../session_events.dart';

/// Turns every Dio failure into one of the app's typed exceptions.
///
/// - timeouts and dropped connections → [NetworkException]
/// - 401 → [UnauthorizedException], and the session is announced as expired
/// - 403 → [ServerException] with the shop's message; only the "account is
///   gone" 403 ([accountGoneMessage]) also announces the session as expired
/// - 4xx and 503 → [ServerException] carrying the shop's own message, which
///   its API writes for customers ("That delivery time is not one this shop
///   offers")
/// - other 5xx → [ServerException] with no message, so only the generic text
///   shows: a 500/502 body may hold a payment gateway's internal error.
class ErrorInterceptor extends Interceptor {
  ErrorInterceptor(this._sessionEvents);

  final SessionEvents _sessionEvents;

  static const Set<String> _signInPaths = {ApiEndpoints.requestCode, ApiEndpoints.verifyCode};

  /// The one 403 that means "this customer is gone": `requireCustomer` in
  /// lib/server/auth/customer-dal.ts answers it for a valid session cookie
  /// whose account was deleted or blocked. Matched exactly, because the shop
  /// sends other 403s under the same paths that are NOT about the session —
  /// the same-site check on the photo upload and on Delete account
  /// ("Photo uploads are only accepted from this shop.") — and signing the
  /// customer out over one of those would lose their place for nothing.
  static const String accountGoneMessage = 'This account can no longer sign in';

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    handler.next(err.copyWith(error: _map(err)));
  }

  /// Whether a 403's [message] is the shop saying the account itself is gone.
  static bool isAccountGone(String? message) => message?.trim() == accountGoneMessage;

  AppException _map(DioException err) {
    final existing = err.error;
    if (existing is AppException) return existing;

    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const NetworkException(isTimeout: true);
      case DioExceptionType.connectionError:
        return const NetworkException();
      default:
        break;
    }

    final status = err.response?.statusCode;
    final body = err.response?.data;
    if (status == null) return const NetworkException();

    if (status == 401) {
      // Signing in answers a wrong or expired code with 401 too. That is
      // not a lost session: show the shop's words ("That code is not right")
      // and leave the cookie jar alone.
      if (_signInPaths.contains(err.requestOptions.path)) {
        return ServerException(message: ApiEnvelope.messageOf(body), statusCode: status);
      }
      _sessionEvents.notifyExpired();
      return const UnauthorizedException();
    }
    // A blocked or deleted customer account: the session cookie is still
    // valid, so the shop answers 403 "This account can no longer sign in" on
    // every signed-in call (account, orders, photo-cake upload). Sign the app
    // out, and say why. Any OTHER 403 is a refusal of this one request: show
    // the shop's words and keep the customer signed in.
    if (status == 403) {
      final message = ApiEnvelope.messageOf(body);
      if (isAccountGone(message)) _sessionEvents.notifyExpired();
      return ServerException(message: message, statusCode: status);
    }
    if (status == 422) {
      return ServerException(
        message: ApiEnvelope.firstErrorMessage(body) ?? ApiEnvelope.messageOf(body),
        statusCode: status,
        field: ApiEnvelope.fieldOf(body),
      );
    }
    if (status == 429) {
      return ServerException(
        message: ApiEnvelope.messageOf(body) ?? AppStrings.errorTooManyRequests,
        statusCode: status,
      );
    }
    if (status == 404) {
      return ServerException(
        message: ApiEnvelope.messageOf(body) ?? AppStrings.errorNotFound,
        statusCode: status,
      );
    }
    final curated = status < 500 || status == 503;
    return ServerException(
      message: curated ? ApiEnvelope.messageOf(body) : null,
      statusCode: status,
      field: ApiEnvelope.fieldOf(body),
    );
  }
}
