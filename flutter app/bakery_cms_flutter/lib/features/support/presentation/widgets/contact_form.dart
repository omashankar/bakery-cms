import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/support_strings.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../domain/entities/contact_message.dart';
import '../bloc/contact_form_cubit.dart';
import '../bloc/contact_form_state.dart';

/// The website's `ContactForm`, field for field: Full Name (required), Phone
/// (optional), Email (required, valid), Subject (optional), Message
/// (required). The shop's `createInquirySchema` refuses the same three.
class ContactForm extends StatefulWidget {
  const ContactForm({super.key, this.initialName = '', this.initialEmail = ''});

  /// Prefilled for a signed-in customer; still editable.
  final String initialName;
  final String initialEmail;

  @override
  State<ContactForm> createState() => _ContactFormState();
}

class _ContactFormState extends State<ContactForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name = TextEditingController(text: widget.initialName);
  late final TextEditingController _email = TextEditingController(text: widget.initialEmail);
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _subject = TextEditingController();
  final TextEditingController _message = TextEditingController();

  static const int _messageLines = 5;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    context.read<ContactFormCubit>().submit(
      ContactMessage(
        name: _name.text,
        email: _email.text,
        phone: _phone.text,
        subject: _subject.text,
        message: _message.text,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ContactFormCubit, ContactFormState>(
      builder: (context, state) {
        String? serverError(String field) =>
            state.status.isFailure && state.errorField == field ? state.errorMessage : null;
        return Form(
          key: _formKey,
          child: AutofillGroup(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AppTextField(
                  key: const ValueKey('contact-name'),
                  label: SupportStrings.nameLabel,
                  hint: SupportStrings.nameHint,
                  controller: _name,
                  validator: Validators.required,
                  errorText: serverError('name'),
                  textInputAction: TextInputAction.next,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  prefixIcon: Icons.person_outline,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  key: const ValueKey('contact-phone'),
                  label: SupportStrings.phoneLabel,
                  hint: SupportStrings.phoneHint,
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  prefixIcon: Icons.phone_outlined,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  key: const ValueKey('contact-email'),
                  label: SupportStrings.emailLabel,
                  hint: SupportStrings.emailHint,
                  controller: _email,
                  validator: Validators.email,
                  errorText: serverError('email'),
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.email],
                  prefixIcon: Icons.mail_outline,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  key: const ValueKey('contact-subject'),
                  label: SupportStrings.subjectLabel,
                  hint: SupportStrings.subjectHint,
                  controller: _subject,
                  textInputAction: TextInputAction.next,
                  textCapitalization: TextCapitalization.sentences,
                  prefixIcon: Icons.subject,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  key: const ValueKey('contact-message'),
                  label: SupportStrings.messageLabel,
                  hint: SupportStrings.messageHint,
                  controller: _message,
                  validator: Validators.required,
                  errorText: serverError('message'),
                  keyboardType: TextInputType.multiline,
                  textInputAction: TextInputAction.newline,
                  textCapitalization: TextCapitalization.sentences,
                  maxLines: _messageLines,
                ),
                const SizedBox(height: AppSpacing.xl),
                AppButton(
                  label: SupportStrings.submit,
                  isLoading: state.status.isLoading,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
