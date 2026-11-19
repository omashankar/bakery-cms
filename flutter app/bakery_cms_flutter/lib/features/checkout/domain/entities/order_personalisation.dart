import 'package:equatable/equatable.dart';

import 'order_sender.dart';

/// Everything "Personalise this gift" collects, as ONE field: the website's
/// `OrderPersonalisation`. The quote stores it on the draft (so an order the
/// payment webhook finishes keeps it) and the order stores it on the order;
/// [termsAcceptedAt] becomes `cancellationPolicy.acceptedAt` there.
class OrderPersonalisation extends Equatable {
  const OrderPersonalisation({this.occasion, this.message, this.sender, this.termsAcceptedAt});

  /// The shop's own word, from the occasions it tagged its products with.
  final String? occasion;

  /// For whoever opens the parcel; not the notes for the shop.
  final String? message;
  final OrderSender? sender;

  /// ISO instant the shop's terms were ticked. Absent means they were not.
  final String? termsAcceptedAt;

  /// The server's limits (`personalisation` in checkout.validators.ts and
  /// order.validators.ts). The form stops typing at these.
  static const int occasionMaxLength = 60;
  static const int messageMaxLength = 500;
  static const int senderNameMaxLength = 120;
  static const int senderPhoneMaxLength = 20;

  @override
  List<Object?> get props => [occasion, message, sender, termsAcceptedAt];
}
