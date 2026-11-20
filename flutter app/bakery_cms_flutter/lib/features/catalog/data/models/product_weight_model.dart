import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/product_weight.dart';

part 'product_weight_model.g.dart';

@JsonSerializable(createToJson: false)
class ProductWeightModel {
  const ProductWeightModel({required this.label, required this.price, this.serves});

  factory ProductWeightModel.fromJson(Map<String, dynamic> json) =>
      _$ProductWeightModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String label;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double price;
  final String? serves;

  ProductWeight toEntity() => ProductWeight(
    label: label,
    price: price,
    serves: (serves ?? '').trim().isEmpty ? null : serves,
  );
}
