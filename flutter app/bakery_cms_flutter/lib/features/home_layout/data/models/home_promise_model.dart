import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/home_promise.dart';

part 'home_promise_model.g.dart';

@JsonSerializable(createToJson: false)
class HomePromiseModel {
  const HomePromiseModel({required this.kind, required this.title, this.subtitle});

  factory HomePromiseModel.fromJson(Map<String, dynamic> json) => _$HomePromiseModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String kind;
  @JsonKey(fromJson: JsonReaders.string)
  final String title;
  final String? subtitle;

  HomePromise? toEntity() => title.trim().isEmpty
      ? null
      : HomePromise(
          kind: kind,
          title: title.trim(),
          subtitle: (subtitle ?? '').trim().isEmpty ? null : subtitle!.trim(),
        );
}
