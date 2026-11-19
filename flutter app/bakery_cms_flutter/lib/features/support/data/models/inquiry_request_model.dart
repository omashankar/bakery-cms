import 'package:json_annotation/json_annotation.dart';

import '../../domain/entities/contact_message.dart';

part 'inquiry_request_model.g.dart';

/// The body of `POST /api/inquiries` from the contact form:
/// `createInquirySchema` (features/inquiries/server/inquiry.validators.ts)
/// with `type: "contact"`. The website's `ContactForm` sends a blank phone or
/// subject as absent (`|| undefined`), so they are left out here too.
@JsonSerializable(createFactory: false, includeIfNull: false)
class InquiryRequestModel {
  const InquiryRequestModel({
    required this.name,
    required this.email,
    required this.message,
    this.phone,
    this.subject,
    this.type = contactType,
  });

  factory InquiryRequestModel.fromEntity(ContactMessage message) => InquiryRequestModel(
    name: message.name.trim(),
    email: message.email.trim(),
    message: message.message.trim(),
    phone: _optional(message.phone),
    subject: _optional(message.subject),
  );

  static const String contactType = 'contact';

  final String type;
  final String name;
  final String email;
  final String? phone;
  final String? subject;
  final String message;

  static String? _optional(String value) => value.trim().isEmpty ? null : value.trim();

  Map<String, dynamic> toJson() => _$InquiryRequestModelToJson(this);
}
