import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../orders/domain/entities/cancellation_class.dart';
import '../../../orders/presentation/widgets/cancellation_class_text.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';

/// The cancellation policy and the consent tick, beside the money: the
/// website's box above its Place order button (checkout-page.tsx).
///
/// A control, not a caption, and unticked to begin with: the order stores
/// the moment it was ticked (`termsAcceptedAt`). Place order is not greyed
/// over it; pressing refuses and says why, under the box.
class TermsSection extends StatelessWidget {
  const TermsSection({super.key});

  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    return BlocSelector<
      CheckoutBloc,
      CheckoutState,
      (List<CancellationClass>, String, String, bool, String?)
    >(
      selector: (state) => (
        state.policyClasses,
        state.cancellationPolicyText,
        state.checkoutTerms,
        state.termsAccepted,
        state.termsError,
      ),
      builder: (context, view) {
        final (classes, policyText, terms, accepted, error) = view;
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.xl),
          child: AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(CheckoutStrings.cancellationPolicy, style: context.text.labelLarge),
                const SizedBox(height: AppSpacing.xs),
                for (final cls in classes) Text('• ${cls.customerText}', style: muted),
                if (policyText.trim().isNotEmpty)
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    childrenPadding: EdgeInsets.zero,
                    expandedAlignment: Alignment.centerLeft,
                    title: Text(CheckoutStrings.readFullPolicy, style: context.text.bodySmall),
                    children: [Text(policyText, style: muted)],
                  ),
                const SizedBox(height: AppSpacing.xs),
                Text(CheckoutStrings.policyAgreedByTick, style: muted),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  value: accepted,
                  isError: error != null,
                  onChanged: (value) =>
                      context.read<CheckoutBloc>().add(CheckoutTermsToggled(value ?? false)),
                  title: Text(
                    terms.trim().isEmpty ? CheckoutStrings.defaultTerms : terms,
                    style: context.text.bodySmall,
                  ),
                ),
                if (error != null)
                  Text(error, style: context.text.bodySmall?.copyWith(color: context.colors.error)),
              ],
            ),
          ),
        );
      },
    );
  }
}
