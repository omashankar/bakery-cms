import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import 'login_step.dart';

/// [status]: initial = waiting for input, loading = request in flight,
/// success = signed in (the router takes it from there), failure = show
/// [errorMessage] and stay on the step.
class LoginState extends Equatable {
  const LoginState({
    this.step = LoginStep.email,
    this.status = ViewStatus.initial,
    this.email = '',
    this.name,
    this.resendSecondsLeft = 0,
    this.codeResent = false,
    this.errorMessage,
  });

  final LoginStep step;
  final ViewStatus status;
  final String email;
  final String? name;
  final int resendSecondsLeft;

  /// True for the one state after a resend succeeded, for a snackbar.
  final bool codeResent;
  final String? errorMessage;

  bool get canResend => resendSecondsLeft == 0 && !status.isLoading;

  LoginState copyWith({
    LoginStep? step,
    ViewStatus? status,
    String? email,
    String? name,
    int? resendSecondsLeft,
    bool codeResent = false,
    String? errorMessage,
  }) {
    return LoginState(
      step: step ?? this.step,
      status: status ?? this.status,
      email: email ?? this.email,
      name: name ?? this.name,
      resendSecondsLeft: resendSecondsLeft ?? this.resendSecondsLeft,
      codeResent: codeResent,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [
    step,
    status,
    email,
    name,
    resendSecondsLeft,
    codeResent,
    errorMessage,
  ];
}
