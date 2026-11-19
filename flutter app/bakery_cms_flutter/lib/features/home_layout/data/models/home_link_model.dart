import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/home_link.dart';

part 'home_link_model.g.dart';

@JsonSerializable(createToJson: false)
class HomeLinkModel {
  const HomeLinkModel({required this.label, required this.href});

  factory HomeLinkModel.fromJson(Map<String, dynamic> json) => _$HomeLinkModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String label;
  @JsonKey(fromJson: JsonReaders.string)
  final String href;

  /// Null when either half is missing: a button with no words or nowhere to
  /// go is not drawn.
  HomeLink? toEntity() => label.trim().isEmpty || href.trim().isEmpty
      ? null
      : HomeLink(label: label.trim(), href: href.trim());
}
