import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../../orders/data/models/order_totals_model.dart';
import '../../domain/entities/order_confirmation.dart';

part 'order_confirmation_model.g.dart';

/// The placed order the shop answers with; checkout reads only these fields.
@JsonSerializable(createToJson: false)
class OrderConfirmationModel {
  const OrderConfirmationModel({
    required this.id,
    required this.orderNumber,
    required this.paymentMethod,
    this.totals,
  });

  factory OrderConfirmationModel.fromJson(Map<String, dynamic> json) =>
      _$OrderConfirmationModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String orderNumber;
  @JsonKey(fromJson: JsonReaders.string)
  final String paymentMethod;
  final OrderTotalsModel? totals;

  OrderConfirmation toEntity() => OrderConfirmation(
    id: id,
    orderNumber: orderNumber,
    total: totals?.total ?? 0,
    paymentMethod: paymentMethod,
  );
}
