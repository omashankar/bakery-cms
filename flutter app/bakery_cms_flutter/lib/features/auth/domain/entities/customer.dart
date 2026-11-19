import 'package:equatable/equatable.dart';

/// A signed-in shopper (`GET /api/customer-auth/me`).
class Customer extends Equatable {
  const Customer({
    required this.id,
    required this.email,
    required this.name,
    required this.phone,
    this.avatarUrl = '',
  });

  final String id;
  final String email;
  final String name;
  final String phone;
  final String avatarUrl;

  /// What to greet them by: their name, or the part of the email before @.
  String get displayName => name.trim().isNotEmpty ? name.trim() : email.split('@').first;

  @override
  List<Object?> get props => [id, email, name, phone, avatarUrl];
}
