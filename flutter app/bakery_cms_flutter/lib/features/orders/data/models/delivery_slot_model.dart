import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';

part 'delivery_slot_model.g.dart';

/// The date and window the customer booked (`deliverySlot` on an order).
@JsonSerializable(createToJson: false)
class DeliverySlotModel {
  const DeliverySlotModel({required this.date, required this.timeSlot, this.tierLabel});

  factory DeliverySlotModel.fromJson(Map<String, dynamic> json) =>
      _$DeliverySlotModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String date;
  @JsonKey(fromJson: JsonReaders.string)
  final String timeSlot;
  final String? tierLabel;
}
