import '../constants/app_strings.dart';
import 'failure.dart';

class ServerFailure extends Failure {
  const ServerFailure([String? message, this.field, this.statusCode])
    : super(message ?? AppStrings.errorServer);

  /// The field the shop refused, so a form can point at it.
  final String? field;

  /// The HTTP status, when the shop answered at all.
  final int? statusCode;

  /// 5xx: the shop failed, so the outcome of the request is unknown and a
  /// retry with the same idempotency key is safe. A 4xx is a decision.
  bool get isServerError => statusCode != null && statusCode! >= 500;

  @override
  List<Object?> get props => [message, field, statusCode];
}
