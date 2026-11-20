import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/account_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../auth/domain/entities/customer.dart';
import '../bloc/profile_cubit.dart';
import '../bloc/profile_state.dart';

/// Name and phone, edited in a bottom sheet over the account screen.
class EditProfileSheet extends StatefulWidget {
  const EditProfileSheet({super.key, required this.customer});

  final Customer customer;

  static Future<void> show(BuildContext context, Customer customer) {
    final cubit = context.read<ProfileCubit>()..reset();
    return showModalBottomSheet<void>(
      context: context,
      // Over the tab bar, not under it: the tab's own navigator would
      // leave the bar drawn across the bottom of the sheet.
      useRootNavigator: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => BlocProvider.value(
        value: cubit,
        child: EditProfileSheet(customer: customer),
      ),
    );
  }

  @override
  State<EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends State<EditProfileSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name = TextEditingController(text: widget.customer.name);
  late final TextEditingController _phone = TextEditingController(text: widget.customer.phone);

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  static String? _optionalPhone(String? value) =>
      (value == null || value.trim().isEmpty) ? null : Validators.phone(value);

  void _save() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    context.read<ProfileCubit>().save(name: _name.text, phone: _phone.text);
  }

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.viewInsetsOf(context);
    return BlocListener<ProfileCubit, ProfileState>(
      listenWhen: (previous, current) => previous.status != current.status,
      listener: (context, state) {
        // Only success leaves the sheet. A failure is shown inside it (below):
        // a snackbar would land on the account page, under the sheet.
        if (state.status.isSuccess) {
          AppSnackbar.success(context, AccountStrings.profileSaved);
          Navigator.of(context).pop();
        }
      },
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.xl,
          0,
          AppSpacing.xl,
          AppSpacing.xl + insets.bottom,
        ),
        child: Form(
          key: _formKey,
          // Scrolls, so the keyboard plus large text never overflows it.
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(AccountStrings.editProfile, style: context.text.titleLarge),
                const SizedBox(height: AppSpacing.lg),
                AppTextField(
                  label: AccountStrings.nameLabel,
                  controller: _name,
                  validator: Validators.required,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.name],
                  maxLength: 120,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  label: AccountStrings.phoneLabel,
                  controller: _phone,
                  validator: _optionalPhone,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  maxLength: 16,
                  onSubmitted: (_) => _save(),
                ),
                const _SaveError(),
                const SizedBox(height: AppSpacing.xl),
                BlocSelector<ProfileCubit, ProfileState, bool>(
                  selector: (state) => state.status.isLoading,
                  builder: (context, isSaving) => AppButton(
                    label: AccountStrings.saveProfile,
                    isLoading: isSaving,
                    onPressed: _save,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SaveError extends StatelessWidget {
  const _SaveError();

  @override
  Widget build(BuildContext context) {
    return BlocSelector<ProfileCubit, ProfileState, String?>(
      selector: (state) => state.status.isFailure ? state.errorMessage : null,
      builder: (context, message) => message == null
          ? const SizedBox.shrink()
          : Padding(
              padding: const EdgeInsets.only(top: AppSpacing.md),
              child: Text(
                message,
                style: context.text.bodySmall?.copyWith(color: context.colors.error),
              ),
            ),
    );
  }
}
