import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/auth/domain/usecases/request_code_params.dart';
import 'package:bakery_cms_flutter/features/auth/domain/usecases/request_sign_in_code.dart';
import 'package:bakery_cms_flutter/features/auth/domain/usecases/verify_code_params.dart';
import 'package:bakery_cms_flutter/features/auth/domain/usecases/verify_sign_in_code.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/login_bloc.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/login_event.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/login_state.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/login_step.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../../auth_fixtures.dart';

class _MockRequestSignInCode extends Mock implements RequestSignInCode {}

class _MockVerifySignInCode extends Mock implements VerifySignInCode {}

void main() {
  late _MockRequestSignInCode requestCode;
  late _MockVerifySignInCode verifyCode;

  const email = 'riya@example.com';
  const codeStep = LoginState(step: LoginStep.code, email: email);
  const wrongCode = 'That code is not right. Please check and try again.';

  setUpAll(() {
    registerFallbackValue(const RequestCodeParams(email: email));
    registerFallbackValue(const VerifyCodeParams(email: email, code: '000000'));
  });

  setUp(() {
    requestCode = _MockRequestSignInCode();
    verifyCode = _MockVerifySignInCode();
  });

  LoginBloc build({Duration cooldown = Duration.zero}) => LoginBloc(
    requestSignInCode: requestCode,
    verifySignInCode: verifyCode,
    resendCooldown: cooldown,
  );

  blocTest<LoginBloc, LoginState>(
    'a sent code moves to the code step',
    setUp: () => when(() => requestCode(any())).thenAnswer((_) async => const Right(unit)),
    build: build,
    act: (bloc) => bloc.add(const LoginCodeRequested(email: ' $email ', name: 'Riya')),
    expect: () => [
      const LoginState(status: ViewStatus.loading, email: email, name: 'Riya'),
      const LoginState(step: LoginStep.code, email: email, name: 'Riya'),
    ],
    verify: (_) => verify(
      () => requestCode(const RequestCodeParams(email: ' $email ', name: 'Riya')),
    ).called(1),
  );

  blocTest<LoginBloc, LoginState>(
    'a refused send stays on the email step with the shop’s message',
    setUp: () => when(
      () => requestCode(any()),
    ).thenAnswer((_) async => const Left(ServerFailure('Too many attempts.'))),
    build: build,
    act: (bloc) => bloc.add(const LoginCodeRequested(email: email)),
    expect: () => [
      const LoginState(status: ViewStatus.loading, email: email),
      const LoginState(
        status: ViewStatus.failure,
        email: email,
        errorMessage: 'Too many attempts.',
      ),
    ],
  );

  blocTest<LoginBloc, LoginState>(
    'a correct code signs in',
    setUp: () => when(() => verifyCode(any())).thenAnswer((_) async => const Right(testCustomer)),
    build: build,
    seed: () => codeStep,
    act: (bloc) => bloc.add(const LoginCodeSubmitted('123456')),
    expect: () => [
      const LoginState(step: LoginStep.code, status: ViewStatus.loading, email: email),
      const LoginState(step: LoginStep.code, status: ViewStatus.success, email: email),
    ],
    verify: (_) =>
        verify(() => verifyCode(const VerifyCodeParams(email: email, code: '123456'))).called(1),
  );

  blocTest<LoginBloc, LoginState>(
    'a wrong code shows the shop’s message and stays on the code step',
    setUp: () =>
        when(() => verifyCode(any())).thenAnswer((_) async => const Left(ServerFailure(wrongCode))),
    build: build,
    seed: () => codeStep,
    act: (bloc) => bloc.add(const LoginCodeSubmitted('111111')),
    expect: () => [
      const LoginState(step: LoginStep.code, status: ViewStatus.loading, email: email),
      const LoginState(
        step: LoginStep.code,
        status: ViewStatus.failure,
        email: email,
        errorMessage: wrongCode,
      ),
    ],
  );

  blocTest<LoginBloc, LoginState>(
    'resend is refused while the cooldown runs',
    build: build,
    seed: () => codeStep.copyWith(resendSecondsLeft: 12),
    act: (bloc) => bloc.add(const LoginCodeResendRequested()),
    expect: () => <LoginState>[],
    verify: (_) => verifyNever(() => requestCode(any())),
  );

  blocTest<LoginBloc, LoginState>(
    'a resend after the cooldown says the code was sent',
    setUp: () => when(() => requestCode(any())).thenAnswer((_) async => const Right(unit)),
    build: build,
    seed: () => codeStep,
    act: (bloc) => bloc.add(const LoginCodeResendRequested()),
    expect: () => [
      const LoginState(step: LoginStep.code, status: ViewStatus.loading, email: email),
      const LoginState(step: LoginStep.code, email: email, codeResent: true),
    ],
  );

  blocTest<LoginBloc, LoginState>(
    'the cooldown counts down to zero and stops',
    build: build,
    seed: () => codeStep.copyWith(resendSecondsLeft: 2),
    act: (bloc) => bloc
      ..add(const LoginResendTicked())
      ..add(const LoginResendTicked())
      ..add(const LoginResendTicked()),
    expect: () => [
      codeStep.copyWith(resendSecondsLeft: 1),
      codeStep.copyWith(resendSecondsLeft: 0),
    ],
  );

  blocTest<LoginBloc, LoginState>(
    'changing the email goes back to the first step and keeps the address',
    build: build,
    seed: () => codeStep.copyWith(resendSecondsLeft: 20),
    act: (bloc) => bloc.add(const LoginEmailChangeRequested()),
    expect: () => [const LoginState(email: email)],
  );
}
