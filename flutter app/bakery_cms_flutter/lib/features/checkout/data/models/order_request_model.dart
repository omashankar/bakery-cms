import 'package:json_annotation/json_annotation.dart';

import '../../domain/entities/order_submission.dart';
import 'address_model.dart';
import 'delivery_slot_model.dart';
import 'optional_text.dart';
import 'personalisation_model.dart';
import 'order_line_model.dart';
import 'order_totals_payload_model.dart';

part 'order_request_model.g.dart';

/// The `POST /api/orders` body.
@JsonSerializable(createFactory: false, includeIfNull: false, explicitToJson: true)
class OrderRequestModel {
  const OrderRequestModel({
    required this.id,
    required this.draftId,
    required this.items,
    required this.totals,
    required this.address,
    required this.paymentMethod,
    required this.deliverySlot,
    this.paymentReference,
    this.orderNotes,
    this.personalisation,
  });

  factory OrderRequestModel.fromEntity(OrderSubmission submission) => OrderRequestModel(
    id: submission.id,
    draftId: submission.draftId,
    items: submission.items.map(OrderLineModel.fromEntity).toList(),
    totals: OrderTotalsPayloadModel.fromEntity(submission.totals),
    address: AddressModel.fromEntity(submission.address),
    paymentMethod: submission.paymentMethod.apiValue,
    deliverySlot: DeliverySlotModel.fromEntity(submission.slot),
    paymentReference: optionalText(submission.paymentReference),
    orderNotes: optionalText(submission.orderNotes),
    personalisation: PersonalisationModel.fromEntity(submission.personalisation),
  );

  final String id;
  final String draftId;
  final List<OrderLineModel> items;
  final OrderTotalsPayloadModel totals;
  final AddressModel address;
  final String paymentMethod;
  final DeliverySlotModel deliverySlot;
  final String? paymentReference;
  final String? orderNotes;
  final PersonalisationModel? personalisation;

  Map<String, dynamic> toJson() => _$OrderRequestModelToJson(this);
}
