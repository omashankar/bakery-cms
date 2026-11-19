import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_loader.dart';
import '../bloc/contact_details_cubit.dart';
import '../bloc/contact_details_state.dart';
import 'get_in_touch_card.dart';
import 'opening_hours_card.dart';

/// The shop's details under the form, in its own four states: a loader, a
/// failure with retry, nothing at all when the shop publishes nothing, and
/// the cards.
class ContactDetailsSection extends StatelessWidget {
  const ContactDetailsSection({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ContactDetailsCubit, ContactDetailsState>(
      builder: (context, state) {
        if (state.status.isPending) {
          return const Padding(padding: EdgeInsets.all(AppSpacing.xl), child: AppLoader());
        }
        if (state.status.isFailure) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
            child: Column(
              children: [
                Text(
                  state.errorMessage ?? AppStrings.somethingWentWrong,
                  style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.sm),
                AppButton.text(
                  label: AppStrings.retry,
                  onPressed: () => context.read<ContactDetailsCubit>().load(),
                ),
              ],
            ),
          );
        }
        final contact = state.contact;
        final reachable =
            contact.address.isNotEmpty || contact.phone.isNotEmpty || contact.email.isNotEmpty;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (reachable) GetInTouchCard(contact: contact),
            if (contact.openingHours.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              OpeningHoursCard(hours: contact.openingHours),
            ],
          ],
        );
      },
    );
  }
}
