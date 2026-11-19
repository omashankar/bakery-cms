import 'package:equatable/equatable.dart';

/// What the contact form sends (`POST /api/inquiries`, type "contact").
/// [phone] and [subject] are optional; blank means not given.
class ContactMessage extends Equatable {
  const ContactMessage({
    required this.name,
    required this.email,
    required this.message,
    this.phone = '',
    this.subject = '',
  });

  final String name;
  final String email;
  final String message;
  final String phone;
  final String subject;

  @override
  List<Object?> get props => [name, email, message, phone, subject];
}
