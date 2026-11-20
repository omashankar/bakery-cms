import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/date_formatter.dart';
import '../../domain/entities/delivery_slot.dart';

part 'delivery_slot_model.g.dart';

@JsonSerializable(createFactory: false, includeIfNull: false)
class DeliverySlotModel {
  const DeliverySlotModel({
    required this.date,
    required this.timeSlot,
    this.tierId,
    this.tierLabel,
  });

  factory DeliverySlotModel.fromEntity(DeliverySlot slot) => DeliverySlotModel(
    date: DateFormatter.toApiDate(slot.date),
    timeSlot: slot.timeSlot,
    tierId: slot.tierId,
    tierLabel: slot.tierLabel,
  );

  /// `YYYY-MM-DD`.
  final String date;
  final String timeSlot;
  final String? tierId;
  final String? tierLabel;

  Map<String, dynamic> toJson() => _$DeliverySlotModelToJson(this);
}
