import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/payment_methods.dart';

part 'payment_methods_model.g.dart';

@JsonSerializable(createToJson: false)
class PaymentMethodsModel {
  const PaymentMethodsModel({
    required this.cod,
    required this.upi,
    required this.card,
    required this.razorpay,
  });

  factory PaymentMethodsModel.fromJson(Map<String, dynamic> json) =>
      _$PaymentMethodsModelFromJson(json);

  /// COD is the shop's default when the setting is missing.
  @JsonKey(fromJson: JsonReaders.boolTrue)
  final bool cod;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool upi;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool card;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool razorpay;

  PaymentMethods toEntity() => PaymentMethods(cod: cod, upi: upi, card: card, razorpay: razorpay);
}
