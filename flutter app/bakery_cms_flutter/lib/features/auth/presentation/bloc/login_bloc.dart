import 'dart:async';

import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_durations.dart';
import '../../../../core/utils/view_status.dart';
import '../../domain/usecases/request_code_params.dart';
import '../../domain/usecases/request_sign_in_code.dart';
import '../../domain/usecases/verify_code_params.dart';
import '../../domain/usecases/verify_sign_in_code.dart';
import 'login_event.dart';
import 'login_state.dart';
import 'login_step.dart';

/// Email → code → signed in. A successful verify updates the auth
/// repository, which `AuthBloc` follows; this bloc only reports success.
class LoginBloc extends Bloc<LoginEvent, LoginState> {
  LoginBloc({
    required RequestSignInCode requestSignInCode,
    required VerifySignInCode verifySignInCode,
    Duration resendCooldown = AppDurations.resendCooldown,
  }) : _requestCode = requestSignInCode,
       _verifyCode = verifySignInCode,
       _cooldownSeconds = resendCooldown.inSeconds,
       super(const LoginState()) {
    // A second tap while a request is in flight is dropped, not queued: each
    // send costs the shop an email and counts against a 5-per-15-minute limit.
    on<LoginCodeRequested>(_onCodeRequested, transformer: droppable());
    on<LoginCodeResendRequested>(_onResendRequested, transformer: droppable());
    on<LoginCodeSubmitted>(_onCodeSubmitted, transformer: droppable());
    on<LoginEmailChangeRequested>(_onEmailChangeRequested);
    on<LoginResendTicked>(_onResendTicked);
  }

  final RequestSignInCode _requestCode;
  final VerifySignInCode _verifyCode;
  final int _cooldownSeconds;
  Timer? _cooldown;

  Future<void> _onCodeRequested(LoginCodeRequested event, Emitter<LoginState> emit) async {
    emit(state.copyWith(status: ViewStatus.loading, email: event.email.trim(), name: event.name));
    final result = await _requestCode(RequestCodeParams(email: event.email, name: event.name));
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (_) {
        emit(
          state.copyWith(
            step: LoginStep.code,
            status: ViewStatus.initial,
            resendSecondsLeft: _cooldownSeconds,
          ),
        );
        _startCooldown();
      },
    );
  }

  Future<void> _onResendRequested(LoginCodeResendRequested event, Emitter<LoginState> emit) async {
    if (!state.canResend) return;
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _requestCode(RequestCodeParams(email: state.email, name: state.name));
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (_) {
        emit(
          state.copyWith(
            status: ViewStatus.initial,
            resendSecondsLeft: _cooldownSeconds,
            codeResent: true,
          ),
        );
        _startCooldown();
      },
    );
  }

  Future<void> _onCodeSubmitted(LoginCodeSubmitted event, Emitter<LoginState> emit) async {
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _verifyCode(VerifyCodeParams(email: state.email, code: event.code));
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (_) {
        _cooldown?.cancel();
        emit(state.copyWith(status: ViewStatus.success, resendSecondsLeft: 0));
      },
    );
  }

  void _onEmailChangeRequested(LoginEmailChangeRequested event, Emitter<LoginState> emit) {
    _cooldown?.cancel();
    emit(state.copyWith(step: LoginStep.email, status: ViewStatus.initial, resendSecondsLeft: 0));
  }

  void _onResendTicked(LoginResendTicked event, Emitter<LoginState> emit) {
    final left = state.resendSecondsLeft - 1;
    if (left <= 0) _cooldown?.cancel();
    emit(
      state.copyWith(
        status: state.status,
        resendSecondsLeft: left < 0 ? 0 : left,
        errorMessage: state.errorMessage,
      ),
    );
  }

  void _startCooldown() {
    _cooldown?.cancel();
    if (_cooldownSeconds <= 0) return;
    _cooldown = Timer.periodic(const Duration(seconds: 1), (_) => add(const LoginResendTicked()));
  }

  @override
  Future<void> close() {
    _cooldown?.cancel();
    return super.close();
  }
}
