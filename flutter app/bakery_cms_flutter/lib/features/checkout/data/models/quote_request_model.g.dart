// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'quote_request_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$QuoteRequestModelToJson(QuoteRequestModel instance) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'couponCode': ?instance.couponCode,
  'giftWrap': ?instance.giftWrap,
  'deliveryTierId': ?instance.deliveryTierId,
  'deliveryAddress': ?instance.deliveryAddress?.toJson(),
  'address': ?instance.address?.toJson(),
  'deliverySlot': ?instance.deliverySlot?.toJson(),
  'orderNotes': ?instance.orderNotes,
  'personalisation': ?instance.personalisation?.toJson(),
};
