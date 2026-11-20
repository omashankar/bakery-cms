// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pin_check_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PinCheckModel _$PinCheckModelFromJson(Map<String, dynamic> json) => PinCheckModel(
  status: JsonReaders.string(json['status']),
  message: PinCheckModel._text(json['message']),
  charge: JsonReaders.toDoubleOrNull(json['charge']),
  city: PinCheckModel._text(json['city']),
  state: PinCheckModel._text(json['state']),
  postalCode: PinCheckModel._text(json['postalCode']),
  formattedAddress: PinCheckModel._text(json['formattedAddress']),
  minDeliveryDays: PinCheckModel._days(json['minDeliveryDays']),
  freeDeliveryThreshold: PinCheckModel._number(json['freeDeliveryThreshold']),
  region: PinCheckModel._region(json['region']),
  pincodeSure: json['pincodeSure'] == null ? false : JsonReaders.boolOr(json['pincodeSure']),
  otherPincodes: json['otherPincodes'] == null
      ? const []
      : JsonReaders.strings(json['otherPincodes']),
  cityNote: PinCheckModel._text(json['cityNote']),
  field: PinCheckModel._text(json['field']),
  found: PinCheckModel._found(json['found']),
  kmToArea: PinCheckModel._number(json['kmToArea']),
);
