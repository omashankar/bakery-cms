import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/constants/strings/delivery_area_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../store/presentation/widgets/shop_currency.dart';
import '../bloc/delivery_area_cubit.dart';
import '../bloc/pincode_check_cubit.dart';
import '../bloc/pincode_check_state.dart';
import 'delivery_verdict_line.dart';

/// "Where should we deliver?": a 6-digit PIN code, Check, the shop's answer,
/// and Save, which makes it the app-wide delivery area.
///
/// Open it with [PincodeSheet.show]; it needs the app-wide
/// `DeliveryAreaCubit` above [BuildContext].
class PincodeSheet extends StatefulWidget {
  const PincodeSheet({super.key});

  /// The six digits India Post uses.
  static const int pincodeLength = 6;

  /// Opens the sheet over the whole app (over the tab bar, not under it) and
  /// completes when it closes, saved or not.
  static Future<void> show(BuildContext context) {
    final area = context.read<DeliveryAreaCubit>();
    return showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => MultiBlocProvider(
        providers: [
          BlocProvider.value(value: area),
          BlocProvider(create: (_) => GetIt.I<PincodeCheckCubit>()),
        ],
        child: const PincodeSheet(),
      ),
    );
  }

  @override
  State<PincodeSheet> createState() => _PincodeSheetState();
}

class _PincodeSheetState extends State<PincodeSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _pincode;

  @override
  void initState() {
    super.initState();
    _pincode = TextEditingController(text: context.read<DeliveryAreaCubit>().state.pincode ?? '');
  }

  @override
  void dispose() {
    _pincode.dispose();
    super.dispose();
  }

  void _check() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    context.read<PincodeCheckCubit>().check(_pincode.text);
  }

  Future<void> _save(PincodeCheckState state) async {
    final answer = state.answer;
    if (answer == null) return;
    final navigator = Navigator.of(context);
    await context.read<DeliveryAreaCubit>().save(answer);
    if (mounted) navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.viewInsetsOf(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(AppSpacing.xl, 0, AppSpacing.xl, AppSpacing.xl + insets.bottom),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: BlocBuilder<PincodeCheckCubit, PincodeCheckState>(
            builder: (context, state) => Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(DeliveryAreaStrings.sheetTitle, style: context.text.titleLarge),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  DeliveryAreaStrings.sheetMessage,
                  style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
                ),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: AppTextField(
                        label: DeliveryAreaStrings.pincodeLabel,
                        hint: DeliveryAreaStrings.pincodeHint,
                        controller: _pincode,
                        validator: Validators.pincode,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        maxLength: PincodeSheet.pincodeLength,
                        autofillHints: const [AutofillHints.postalCode],
                        prefixIcon: Icons.location_on_outlined,
                        autofocus: _pincode.text.isEmpty,
                        onChanged: (_) => context.read<PincodeCheckCubit>().reset(),
                        onSubmitted: (_) => _check(),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.xs),
                      child: AppButton.secondary(
                        label: DeliveryAreaStrings.check,
                        isLoading: state.status.isLoading,
                        expand: false,
                        onPressed: _check,
                      ),
                    ),
                  ],
                ),
                _Answer(state: state),
                const SizedBox(height: AppSpacing.xl),
                AppButton(
                  label: DeliveryAreaStrings.save,
                  onPressed: state.status.isSuccess ? () => _save(state) : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The shop's answer, or why it could not be had (with a retry).
class _Answer extends StatelessWidget {
  const _Answer({required this.state});

  final PincodeCheckState state;

  @override
  Widget build(BuildContext context) {
    final answer = state.answer;
    if (state.status.isSuccess && answer != null) {
      return Padding(
        padding: const EdgeInsets.only(top: AppSpacing.md),
        child: DeliveryVerdictLine(area: answer, currency: context.shopCurrency),
      );
    }
    if (state.status.isFailure) {
      return Padding(
        padding: const EdgeInsets.only(top: AppSpacing.md),
        child: Row(
          children: [
            Expanded(
              child: Text(
                state.errorMessage ?? AppStrings.errorUnknown,
                style: context.text.bodySmall?.copyWith(color: context.colors.error),
              ),
            ),
            AppButton.text(
              label: AppStrings.retry,
              onPressed: () => context.read<PincodeCheckCubit>().retry(),
            ),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }
}
