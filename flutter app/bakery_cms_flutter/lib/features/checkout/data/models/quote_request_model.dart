import 'package:json_annotation/json_annotation.dart';

import '../../domain/entities/quote_request.dart';
import 'address_model.dart';
import 'delivery_area_model.dart';
import 'delivery_slot_model.dart';
import 'optional_text.dart';
import 'personalisation_model.dart';
import 'quote_line_model.dart';

part 'quote_request_model.g.dart';

/// The `POST /api/checkout/quote` body.
@JsonSerializable(createFactory: false, includeIfNull: false, explicitToJson: true)
class QuoteRequestModel {
  const QuoteRequestModel({
    required this.items,
    this.couponCode,
    this.giftWrap,
    this.deliveryTierId,
    this.deliveryAddress,
    this.address,
    this.deliverySlot,
    this.orderNotes,
    this.personalisation,
  });

  factory QuoteRequestModel.fromEntity(QuoteRequest request) {
    final pincode = optionalText(request.pincode);
    final city = optionalText(request.city);
    final state = optionalText(request.state);
    final hasArea = pincode != null || city != null || state != null;
    return QuoteRequestModel(
      items: request.items.map(QuoteLineModel.fromEntity).toList(),
      couponCode: optionalText(request.couponCode),
      giftWrap: request.giftWrap ? true : null,
      deliveryTierId: optionalText(request.deliveryTierId),
      deliveryAddress: request.address == null && hasArea
          ? DeliveryAreaModel(city: city, pincode: pincode, state: state)
          : null,
      address: request.address == null ? null : AddressModel.fromEntity(request.address!),
      deliverySlot: request.slot == null ? null : DeliverySlotModel.fromEntity(request.slot!),
      orderNotes: optionalText(request.orderNotes),
      personalisation: PersonalisationModel.fromEntity(request.personalisation),
    );
  }

  final List<QuoteLineModel> items;
  final String? couponCode;
  final bool? giftWrap;
  final String? deliveryTierId;
  final DeliveryAreaModel? deliveryAddress;
  final AddressModel? address;
  final DeliverySlotModel? deliverySlot;
  final String? orderNotes;
  final PersonalisationModel? personalisation;

  Map<String, dynamic> toJson() => _$QuoteRequestModelToJson(this);
}
