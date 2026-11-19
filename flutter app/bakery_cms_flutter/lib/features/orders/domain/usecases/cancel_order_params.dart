import 'package:equatable/equatable.dart';

class CancelOrderParams extends Equatable {
  const CancelOrderParams({required this.orderNumber, this.reason});

  final String orderNumber;

  /// Optional, up to 300 characters.
  final String? reason;

  @override
  List<Object?> get props => [orderNumber, reason];
}
