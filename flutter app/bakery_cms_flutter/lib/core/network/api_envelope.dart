import '../error/server_exception.dart';

/// Reads the shop's response bodies.
///
/// New endpoints answer `{ success, message, data, errors }`; a few older ones
/// (`/api/products`, `/api/razorpay/*`) answer a bare object. [unwrap] returns
/// the payload either way and throws on an envelope that says it failed.
abstract final class ApiEnvelope {
  static Object? unwrap(Object? body) {
    if (body is Map<String, dynamic> && body.containsKey('success')) {
      if (body['success'] != true) {
        throw ServerException(message: messageOf(body), field: fieldOf(body));
      }
      return body['data'];
    }
    return body;
  }

  /// The message the shop wrote for this refusal, from either body shape.
  static String? messageOf(Object? body) {
    if (body is! Map<String, dynamic>) return null;
    final message = body['message'] ?? body['error'];
    return message is String && message.trim().isNotEmpty ? message : null;
  }

  /// The first field error's own message ("Please enter a valid email").
  /// A 422's top-level message is only "Validation failed".
  static String? firstErrorMessage(Object? body) {
    if (body is! Map<String, dynamic>) return null;
    final errors = body['errors'];
    if (errors is List && errors.isNotEmpty) {
      final first = errors.first;
      if (first is Map<String, dynamic>) {
        final message = first['message'];
        if (message is String && message.trim().isNotEmpty) return message;
      }
    }
    return null;
  }

  static String? fieldOf(Object? body) {
    if (body is! Map<String, dynamic>) return null;
    final errors = body['errors'];
    if (errors is List && errors.isNotEmpty) {
      final first = errors.first;
      if (first is Map<String, dynamic> && first['field'] is String) {
        return first['field'] as String;
      }
    }
    return null;
  }
}
