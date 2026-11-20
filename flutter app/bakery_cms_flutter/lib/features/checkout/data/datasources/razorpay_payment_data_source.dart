import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../domain/entities/payment_request.dart';
import '../../domain/entities/payment_result.dart';
import '../exceptions/payment_exception.dart';
import 'payment_data_source.dart';

/// The Razorpay checkout sheet, turned from callbacks into one Future.
class RazorpayPaymentDataSource implements PaymentDataSource {
  const RazorpayPaymentDataSource();

  @override
  bool get isSupported =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  @override
  Future<PaymentResult> pay(PaymentRequest request) async {
    final razorpay = Razorpay();
    final completer = Completer<PaymentResult>();

    void succeed(PaymentSuccessResponse response) {
      if (completer.isCompleted) return;
      final paymentId = response.paymentId ?? '';
      if (paymentId.isEmpty) {
        completer.completeError(const PaymentException());
        return;
      }
      completer.complete(
        PaymentResult(
          paymentId: paymentId,
          orderId: response.orderId,
          signature: response.signature,
        ),
      );
    }

    void fail(PaymentFailureResponse response) {
      if (completer.isCompleted) return;
      completer.completeError(
        PaymentException(cancelled: response.code == Razorpay.PAYMENT_CANCELLED),
      );
    }

    // A wallet hand-off still ends in a success or an error event.
    void externalWallet(ExternalWalletResponse _) {}

    razorpay
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, succeed)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, fail)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, externalWallet);

    try {
      razorpay.open({
        'key': request.order.keyId,
        'order_id': request.order.orderId,
        'amount': request.order.amount,
        'currency': request.order.currency,
        'name': request.shopName,
        'description': request.description,
        'prefill': {'name': request.name, 'email': request.email, 'contact': request.phone},
      });
      return await completer.future;
    } finally {
      razorpay.clear();
    }
  }
}
