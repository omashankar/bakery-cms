// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'public_settings_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PublicSettingsModel _$PublicSettingsModelFromJson(Map<String, dynamic> json) => PublicSettingsModel(
  general: GeneralSettingsModel.fromJson(json['general'] as Map<String, dynamic>),
  commerce: CommerceSettingsModel.fromJson(json['commerce'] as Map<String, dynamic>),
  maintenance: json['maintenance'] == null
      ? null
      : MaintenanceModel.fromJson(json['maintenance'] as Map<String, dynamic>),
  modules: json['modules'] == null ? const {} : PublicSettingsModel._modules(json['modules']),
);
