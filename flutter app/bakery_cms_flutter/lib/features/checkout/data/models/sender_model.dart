import 'package:json_annotation/json_annotation.dart';

import '../../domain/entities/order_sender.dart';

part 'sender_model.g.dart';

/// `personalisation.sender`: name and phone always (blank allowed), and
/// `hideFromRecipient` only when ticked, as the website sends it
/// (`hideFromRecipient: hideSender || undefined`).
@JsonSerializable(createFactory: false, includeIfNull: false)
class SenderModel {
  const SenderModel({required this.name, required this.phone, this.hideFromRecipient});

  factory SenderModel.fromEntity(OrderSender sender) => SenderModel(
    name: sender.name.trim(),
    phone: sender.phone.trim(),
    hideFromRecipient: sender.hideFromRecipient ? true : null,
  );

  final String name;
  final String phone;
  final bool? hideFromRecipient;

  Map<String, dynamic> toJson() => _$SenderModelToJson(this);
}
