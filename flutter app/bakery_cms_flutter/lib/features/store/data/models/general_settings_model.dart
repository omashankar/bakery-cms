import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';

part 'general_settings_model.g.dart';

@JsonSerializable(createToJson: false)
class GeneralSettingsModel {
  const GeneralSettingsModel({
    required this.siteName,
    required this.siteTagline,
    required this.logo,
    required this.currency,
    this.timezone = '',
    this.favicon = '',
  });

  factory GeneralSettingsModel.fromJson(Map<String, dynamic> json) =>
      _$GeneralSettingsModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String siteName;
  @JsonKey(fromJson: JsonReaders.string)
  final String siteTagline;
  @JsonKey(fromJson: JsonReaders.string)
  final String logo;
  @JsonKey(fromJson: JsonReaders.string)
  final String currency;

  /// IANA zone ("Asia/Kolkata"). Delivery dates and cut-offs follow this
  /// clock, not the phone's.
  @JsonKey(fromJson: JsonReaders.string)
  final String timezone;

  /// The shop's small square mark, shown beside its name.
  @JsonKey(fromJson: JsonReaders.string)
  final String favicon;
}
