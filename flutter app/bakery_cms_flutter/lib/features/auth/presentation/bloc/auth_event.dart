import 'package:equatable/equatable.dart';

sealed class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => const [];
}

/// Once, at launch: restore the saved session, then follow every change.
final class AuthStarted extends AuthEvent {
  const AuthStarted();
}

final class AuthSignOutRequested extends AuthEvent {
  const AuthSignOutRequested();
}
