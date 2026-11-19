import 'package:flutter/material.dart';
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

class EmailStepForm extends StatefulWidget {
  const EmailStepForm({super.key});

  @override
  State<EmailStepForm> createState() => _EmailStepFormState();
}

class _EmailStepFormState extends State<EmailStepForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _email;
  late final TextEditingController _name;

  @override
  void initState() {
    super.initState();
    // Coming back from "use a different email" keeps what was typed.
    final state = context.read<LoginBloc>().state;
    _email = TextEditingController(text: state.email);
    _name = TextEditingController(text: state.name ?? '');
  }

  @override
  void dispose() {
    _email.dispose();
    _name.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    context.read<LoginBloc>().add(LoginCodeRequested(email: _email.text, name: _name.text));
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const LoginHeading(title: AuthStrings.headline, message: AuthStrings.intro),
            AppTextField(
              label: AuthStrings.emailLabel,
              hint: AuthStrings.emailHint,
              controller: _email,
              validator: Validators.email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              prefixIcon: Icons.mail_outline,
              autofocus: true,
            ),
            const SizedBox(height: AppSpacing.md),
            AppTextField(
              label: AuthStrings.nameLabel,
              hint: AuthStrings.nameHint,
              controller: _name,
              textInputAction: TextInputAction.done,
              textCapitalization: TextCapitalization.words,
              autofillHints: const [AutofillHints.name],
              prefixIcon: Icons.person_outline,
              maxLength: 120,
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: AppSpacing.xl),
            BlocSelector<LoginBloc, LoginState, bool>(
              selector: (state) => state.status.isLoading,
              builder: (context, isLoading) =>
                  AppButton(label: AuthStrings.sendCode, isLoading: isLoading, onPressed: _submit),
            ),
          ],
        ),
      ),
    );
  }
}
