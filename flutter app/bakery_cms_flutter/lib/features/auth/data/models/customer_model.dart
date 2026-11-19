import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/customer.dart';

part 'customer_model.g.dart';

/// The customer as `GET /api/customer-auth/me` and the profile endpoint
/// answer it.
@JsonSerializable(createToJson: false)
class CustomerModel {
  const CustomerModel({
    required this.id,
    required this.email,
    required this.name,
    required this.phone,
    required this.avatarUrl,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> json) => _$CustomerModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String email;
  @JsonKey(fromJson: JsonReaders.string)
  final String name;
  @JsonKey(fromJson: JsonReaders.string)
  final String phone;
  @JsonKey(fromJson: JsonReaders.string)
  final String avatarUrl;

  Customer toEntity() =>
      Customer(id: id, email: email, name: name, phone: phone, avatarUrl: avatarUrl);
}
