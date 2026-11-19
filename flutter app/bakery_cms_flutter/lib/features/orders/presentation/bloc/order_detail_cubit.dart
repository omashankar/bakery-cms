import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/usecases/cancel_order.dart';
import '../../domain/usecases/cancel_order_params.dart';
import '../../domain/usecases/email_invoice.dart';
import '../../domain/usecases/email_invoice_params.dart';
import '../../domain/usecases/get_order_details.dart';
import 'order_detail_state.dart';

class OrderDetailCubit extends Cubit<OrderDetailState> {
  OrderDetailCubit({
    required GetOrderDetails getOrderDetails,
    required CancelOrder cancelOrder,
    EmailInvoice? emailInvoice,
  }) : _getOrderDetails = getOrderDetails,
       _cancelOrder = cancelOrder,
       _emailInvoice = emailInvoice,
       super(const OrderDetailState());

  final GetOrderDetails _getOrderDetails;
  final CancelOrder _cancelOrder;
  final EmailInvoice? _emailInvoice;

  bool get canEmailInvoice => _emailInvoice != null;

  Future<void> load(String orderNumber) async {
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _getOrderDetails(orderNumber);
    if (isClosed) return; // the screen was left mid-request
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (details) => emit(state.copyWith(status: ViewStatus.success, details: details)),
    );
  }

  Future<void> cancel({String? reason}) async {
    final details = state.details;
    if (details == null || !details.canCancel || state.cancelStatus.isLoading) return;
    emit(state.copyWith(cancelStatus: ViewStatus.loading));
    final result = await _cancelOrder(
      CancelOrderParams(orderNumber: details.order.orderNumber, reason: reason),
    );
    if (isClosed) return; // the screen was left mid-request
    result.match(
      (failure) =>
          emit(state.copyWith(cancelStatus: ViewStatus.failure, cancelError: failure.message)),
      (updated) => emit(state.copyWith(cancelStatus: ViewStatus.success, details: updated)),
    );
  }

  /// "Email invoice": the shop mails the order's own address. Once per
  /// press; a second press while one is on its way does nothing.
  Future<void> emailInvoice() async {
    final details = state.details;
    final send = _emailInvoice;
    if (details == null || send == null || state.invoiceStatus.isLoading) return;
    emit(state.copyWith(invoiceStatus: ViewStatus.loading));
    final order = details.order;
    final result = await send(
      EmailInvoiceParams(orderNumber: order.orderNumber, email: order.address.email),
    );
    if (isClosed) return; // the screen was left mid-request
    result.match(
      (failure) =>
          emit(state.copyWith(invoiceStatus: ViewStatus.failure, invoiceError: failure.message)),
      (to) => emit(state.copyWith(invoiceStatus: ViewStatus.success, invoiceSentTo: to)),
    );
  }
}
