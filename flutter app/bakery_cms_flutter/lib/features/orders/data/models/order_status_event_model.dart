import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/order_status.dart';
import '../../domain/entities/order_status_event.dart';

part 'order_status_event_model.g.dart';

@JsonSerializable(createToJson: false)
class OrderStatusEventModel {
  const OrderStatusEventModel({required this.status, required this.at});

  factory OrderStatusEventModel.fromJson(Map<String, dynamic> json) =>
      _$OrderStatusEventModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String status;
  @JsonKey(fromJson: JsonReaders.string)
  final String at;

  OrderStatusEvent toEntity() => OrderStatusEvent(status: OrderStatus.fromApi(status), at: at);
}
