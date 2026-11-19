import 'package:json_annotation/json_annotation.dart';

import '../../domain/entities/order_personalisation.dart';
import 'optional_text.dart';
import 'sender_model.dart';

part 'personalisation_model.g.dart';

/// The `personalisation` object the quote and the order both take, built the
/// way the website's `collectPersonalisation()` builds it (checkout-page.tsx):
/// blanks are left out, a sender only when a name or phone was given, and
/// nothing at all when every part is empty ([fromEntity] answers null).
@JsonSerializable(createFactory: false, includeIfNull: false, explicitToJson: true)
class PersonalisationModel {
  const PersonalisationModel({this.occasion, this.message, this.sender, this.termsAcceptedAt});

  static PersonalisationModel? fromEntity(OrderPersonalisation? value) {
    if (value == null) return null;
    final sender = value.sender;
    final hasSender =
        sender != null && (sender.name.trim().isNotEmpty || sender.phone.trim().isNotEmpty);
    final model = PersonalisationModel(
      occasion: optionalText(value.occasion),
      message: optionalText(value.message),
      sender: hasSender ? SenderModel.fromEntity(sender) : null,
      termsAcceptedAt: optionalText(value.termsAcceptedAt),
    );
    return _isEmpty(model) ? null : model;
  }

  final String? occasion;
  final String? message;
  final SenderModel? sender;
  final String? termsAcceptedAt;

  /// A method, not a getter: json_serializable would send a getter as a key.
  static bool _isEmpty(PersonalisationModel model) =>
      model.occasion == null &&
      model.message == null &&
      model.sender == null &&
      model.termsAcceptedAt == null;

  Map<String, dynamic> toJson() => _$PersonalisationModelToJson(this);
}
