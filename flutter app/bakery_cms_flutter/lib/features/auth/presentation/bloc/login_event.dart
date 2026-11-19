import 'package:equatable/equatable.dart';

sealed class LoginEvent extends Equatable {
  const LoginEvent();

  @override
  List<Object?> get props => const [];
}

final class LoginCodeRequested extends LoginEvent {
  const LoginCodeRequested({required this.email, this.name});

  final String email;
  final String? name;

  @override
  List<Object?> get props => [email, name];
}

final class LoginCodeResendRequested extends LoginEvent {
  const LoginCodeResendRequested();
}

final class LoginCodeSubmitted extends LoginEvent {
  const LoginCodeSubmitted(this.code);

  final String code;

  @override
  List<Object?> get props => [code];
}

/// Back to the email step, to use a different address.
final class LoginEmailChangeRequested extends LoginEvent {
  const LoginEmailChangeRequested();
}

/// Raised by the bloc's own cooldown timer, once a second.
final class LoginResendTicked extends LoginEvent {
  const LoginResendTicked();
}
