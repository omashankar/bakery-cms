import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../../cart/domain/services/line_choices.dart';
import '../../domain/entities/order_line.dart';

part 'order_line_model.g.dart';

@JsonSerializable(createToJson: false)
class OrderLineModel {
  const OrderLineModel({
    required this.productSlug,
    required this.name,
    required this.image,
    required this.price,
    required this.quantity,
    required this.variantSummary,
    this.weight,
    this.weightLabel,
    this.flavour,
    this.shape,
    this.message,
  });

  factory OrderLineModel.fromJson(Map<String, dynamic> json) => _$OrderLineModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String productSlug;
  @JsonKey(fromJson: JsonReaders.string)
  final String name;
  @JsonKey(fromJson: JsonReaders.string)
  final String image;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double price;
  @JsonKey(fromJson: JsonReaders.toInt)
  final int quantity;
  final String? weight;

  /// The shop's word for the size ("Weight", "Size"): heads the value.
  final String? weightLabel;
  final String? flavour;
  final String? shape;
  final String? message;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> variantSummary;

  OrderLine toEntity() => OrderLine(
    productSlug: productSlug,
    name: name,
    image: image,
    price: price,
    quantity: quantity,
    message: (message == null || message!.trim().isEmpty) ? null : message,
    // Labelled, as the website's order pages print them (`cartLineChoices`).
    choices: LineChoices.of(
      weight: weight,
      weightLabel: weightLabel,
      flavour: flavour,
      shape: shape,
      variantSummary: variantSummary,
    ),
  );
}
