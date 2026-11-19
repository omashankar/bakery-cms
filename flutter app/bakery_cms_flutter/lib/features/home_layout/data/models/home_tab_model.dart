import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/home_tab.dart';

part 'home_tab_model.g.dart';

@JsonSerializable(createToJson: false)
class HomeTabModel {
  const HomeTabModel({required this.label, required this.productSlugs, this.href});

  factory HomeTabModel.fromJson(Map<String, dynamic> json) => _$HomeTabModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String label;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> productSlugs;
  final String? href;

  HomeTab? toEntity() => label.trim().isEmpty || productSlugs.isEmpty
      ? null
      : HomeTab(
          label: label.trim(),
          productSlugs: productSlugs,
          href: (href ?? '').trim().isEmpty ? null : href!.trim(),
        );
}
