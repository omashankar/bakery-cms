// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'general_settings_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GeneralSettingsModel _$GeneralSettingsModelFromJson(Map<String, dynamic> json) =>
    GeneralSettingsModel(
      siteName: JsonReaders.string(json['siteName']),
      siteTagline: JsonReaders.string(json['siteTagline']),
      logo: JsonReaders.string(json['logo']),
      currency: JsonReaders.string(json['currency']),
      timezone: json['timezone'] == null ? '' : JsonReaders.string(json['timezone']),
      favicon: json['favicon'] == null ? '' : JsonReaders.string(json['favicon']),
    );
