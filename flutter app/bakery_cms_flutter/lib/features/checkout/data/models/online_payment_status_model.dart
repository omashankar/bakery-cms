import 'package:json_annotation/json_annotation.dart';

part 'online_payment_status_model.g.dart';

/// `GET /api/razorpay/availability`, a bare object (`{ configured, ... }`).
@JsonSerializable(createToJson: false)
class OnlinePaymentStatusModel {
  const OnlinePaymentStatusModel({this.configured});

  factory OnlinePaymentStatusModel.fromJson(Map<String, dynamic> json) =>
      _$OnlinePaymentStatusModelFromJson(json);

  /// Only a real boolean is an answer; anything else is "unknown"
  /// (checkout-page.tsx: `typeof status?.configured === "boolean"`).
  @JsonKey(fromJson: _answer)
  final bool? configured;

  static bool? _answer(Object? value) => value is bool ? value : null;
}
