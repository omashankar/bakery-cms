// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_request_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$OrderRequestModelToJson(OrderRequestModel instance) => <String, dynamic>{
  'id': instance.id,
  'draftId': instance.draftId,
  'items': instance.items.map((e) => e.toJson()).toList(),
  'totals': instance.totals.toJson(),
  'address': instance.address.toJson(),
  'paymentMethod': instance.paymentMethod,
  'deliverySlot': instance.deliverySlot.toJson(),
  'paymentReference': ?instance.paymentReference,
  'orderNotes': ?instance.orderNotes,
  'personalisation': ?instance.personalisation?.toJson(),
};
