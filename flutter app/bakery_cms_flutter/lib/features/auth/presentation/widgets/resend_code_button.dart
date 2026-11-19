import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/auth_strings.dart';
import '../../../../core/widgets/app_button.dart';
import '../bloc/login_bloc.dart';
import '../bloc/login_event.dart';
import '../bloc/login_state.dart';

/// "Resend code", disabled with a countdown while the cooldown runs. Only
/// this button rebuilds each second.
class ResendCodeButton extends StatelessWidget {
  const ResendCodeButton({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocSelector<LoginBloc, LoginState, (int, bool)>(
      selector: (state) => (state.resendSecondsLeft, state.canResend),
      builder: (context, resend) {
        final (secondsLeft, canResend) = resend;
        return AppButton.text(
          label: secondsLeft > 0 ? AuthStrings.resendIn(secondsLeft) : AuthStrings.resend,
          onPressed: canResend
              ? () => context.read<LoginBloc>().add(const LoginCodeResendRequested())
              : null,
        );
      },
    );
  }
}
