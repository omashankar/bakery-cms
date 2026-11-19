import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/auth_strings.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../bloc/login_bloc.dart';
import '../bloc/login_event.dart';
import '../bloc/login_state.dart';
import 'login_heading.dart';
import 'resend_code_button.dart';

class CodeStepForm extends StatefulWidget {
  const CodeStepForm({super.key});

  static const int codeLength = 6;

  @override
  State<CodeStepForm> createState() => _CodeStepFormState();
}

class _CodeStepFormState extends State<CodeStepForm> {
  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    context.read<LoginBloc>().add(LoginCodeSubmitted(_code.text));
  }

  @override
  Widget build(BuildContext context) {
    final email = context.select<LoginBloc, String>((bloc) => bloc.state.email);
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LoginHeading(title: AuthStrings.codeHeadline, message: AuthStrings.codeSentTo(email)),
          AppTextField(
            label: AuthStrings.codeLabel,
            controller: _code,
            validator: Validators.otp,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.done,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            maxLength: CodeStepForm.codeLength,
            autofillHints: const [AutofillHints.oneTimeCode],
            prefixIcon: Icons.pin_outlined,
            autofocus: true,
            onChanged: (value) {
              if (value.length == CodeStepForm.codeLength) _submit();
            },
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: AppSpacing.xl),
          BlocSelector<LoginBloc, LoginState, bool>(
            selector: (state) => state.status.isLoading || state.status.isSuccess,
            builder: (context, isBusy) =>
                AppButton(label: AuthStrings.verify, isLoading: isBusy, onPressed: _submit),
          ),
          const SizedBox(height: AppSpacing.md),
          const ResendCodeButton(),
          AppButton.text(
            label: AuthStrings.changeEmail,
            onPressed: () => context.read<LoginBloc>().add(const LoginEmailChangeRequested()),
          ),
        ],
      ),
    );
  }
}
