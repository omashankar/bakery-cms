/// Copy for My orders and the order detail screen.
abstract final class OrderStrings {
  static const String title = 'My orders';
  static const String emptyTitle = 'No orders yet';
  static const String emptyMessage = 'When you place an order it will show up here.';
  static const String startShopping = 'Start shopping';
  static const String refreshFailed = 'Could not refresh your orders.';

  static String orderTitle(String orderNumber) => 'Order $orderNumber';
  static String placedOn(String when) => 'Placed $when';
  static String itemCount(int count) => count == 1 ? '1 item' : '$count items';
  static String quantity(int count) => 'Qty $count';

  // Sections
  static const String itemsSection = 'Items';
  static const String deliverySection = 'Delivery';
  static const String addressSection = 'Delivery address';
  static const String paymentSection = 'Payment';
  static const String summarySection = 'Price details';
  static const String notesSection = 'Notes';
  static const String messageOnCake = 'Message';

  // Delivery
  static const String deliveryDate = 'Date';
  static const String deliverySlot = 'Time';
  static const String deliverySpeed = 'Speed';
  static const String estimatedDelivery = 'Expected by';

  // Payment
  static const String paymentMethod = 'Method';
  static const String paymentStatus = 'Status';
  static const String cashOnDelivery = 'Cash on delivery';
  static const String paidOnline = 'Paid online';
  static const String paymentPaid = 'Paid';
  static const String paymentPending = 'Pending';
  static const String paymentFailed = 'Failed';
  static const String paymentRefunded = 'Refunded';
  static const String paymentDue = 'Pay on delivery';
  static const String refundInProgress = 'Refund in progress';
  static const String refundDeclined = 'Refund declined';
  static const String refundPending = 'Refund pending';

  // The payment line in the customer's words (the website's `paymentText`
  // in account-orders-page.tsx). Never "Paid online" for money not taken.
  static const String onlinePayment = 'Online payment';
  static const String paidOnDelivery = 'Paid on delivery';
  static const String paymentFailedText = 'Payment failed';
  static const String paymentPendingText = 'Payment pending';
  static const String paidRefundDeclined = 'Paid online · refund declined';
  static const String paidRefundPending = 'Paid online · refund pending';
  static const String paidRefundFailed = 'Paid online · refund failed';
  static String refundedAmount(String amount) => 'Refunded $amount';

  // Cancellation & refund (the website's order page)
  static const String cancellationSection = 'Cancellation & refund';
  static const String policy = 'Policy';
  static const String refund = 'Refund';
  static String agreedOn(String when) => 'Agreed at checkout on $when';
  static const String cancellableUntilPreparing = 'Can be cancelled until we start preparing it.';
  static const String notCancellable = 'Cannot be cancelled once ordered.';

  // The refund's state (`REFUND_STATE_LABELS`)
  static const String refundStatePending = 'Pending';
  static const String refundStateProcessing = 'Processing';
  static const String refundStateProcessed = 'Processed';
  static const String refundStateFailed = 'Failed';

  // Personalisation
  static const String personalisationSection = 'Personalisation';
  static String occasion(String name) => 'Occasion: $name';
  static String quoted(String message) => '“$message”';

  // Invoice
  static const String emailInvoice = 'Email invoice';
  static String invoiceSentTo(String email) => 'Invoice sent. Check $email.';
  static const String invoiceFailed = 'Could not email the invoice';

  // Totals
  static const String subtotal = 'Subtotal';
  static const String delivery = 'Delivery';
  static const String freeDelivery = 'Free';
  static const String deliverySpeedFee = 'Delivery speed';
  static const String giftWrap = 'Gift wrap';
  static const String platformCharge = 'Platform fee';
  static const String tax = 'Tax';
  static const String discount = 'Discount';
  static String couponDiscount(String code) => 'Discount ($code)';
  static const String total = 'Total';

  // Status
  static const String statusPending = 'Order placed';
  static const String statusConfirmed = 'Confirmed';
  static const String statusPreparing = 'Being prepared';
  static const String statusReady = 'Ready';
  static const String statusOutForDelivery = 'Out for delivery';
  static const String statusDelivered = 'Delivered';
  static const String statusCancelled = 'Cancelled';
  static const String statusRefunded = 'Refunded';
  static const String statusUnknown = 'Processing';
  static const String cancelledBanner = 'This order was cancelled.';
  static const String refundedBanner = 'This order was refunded.';

  // Cancel
  static const String cancelOrder = 'Cancel order';
  static const String cancelTitle = 'Cancel this order?';
  static const String cancelMessage =
      'Your order will be cancelled. Anything you paid online is refunded to the way you paid.';
  static const String cancelConfirm = 'Yes, cancel';
  static const String keepOrder = 'Keep order';
  static const String cancelled = 'Your order has been cancelled.';
}
