import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/order_details.dart';

class OrderDetailState extends Equatable {
  const OrderDetailState({
    this.status = ViewStatus.initial,
    this.details,
    this.errorMessage,
    this.cancelStatus = ViewStatus.initial,
    this.cancelError,
    this.invoiceStatus = ViewStatus.initial,
    this.invoiceError,
    this.invoiceSentTo,
  });

  /// Loading the order.
  final ViewStatus status;
  final OrderDetails? details;
  final String? errorMessage;

  /// Cancelling it, tracked apart so a refused cancel keeps the order shown.
  final ViewStatus cancelStatus;
  final String? cancelError;

  /// Emailing the invoice, tracked apart so a failure keeps the order shown.
  final ViewStatus invoiceStatus;
  final String? invoiceError;

  /// The address the shop mailed it to.
  final String? invoiceSentTo;

  OrderDetailState copyWith({
    ViewStatus? status,
    OrderDetails? details,
    String? errorMessage,
    ViewStatus? cancelStatus,
    String? cancelError,
    ViewStatus? invoiceStatus,
    String? invoiceError,
    String? invoiceSentTo,
  }) {
    return OrderDetailState(
      status: status ?? this.status,
      details: details ?? this.details,
      errorMessage: errorMessage,
      cancelStatus: cancelStatus ?? this.cancelStatus,
      cancelError: cancelError,
      invoiceStatus: invoiceStatus ?? this.invoiceStatus,
      invoiceError: invoiceError,
      invoiceSentTo: invoiceSentTo ?? this.invoiceSentTo,
    );
  }

  @override
  List<Object?> get props => [
    status,
    details,
    errorMessage,
    cancelStatus,
    cancelError,
    invoiceStatus,
    invoiceError,
    invoiceSentTo,
  ];
}
