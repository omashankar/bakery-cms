import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/support_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../domain/entities/contact_channel.dart';
import '../../domain/entities/shop_contact.dart';
import 'contact_detail_tile.dart';

/// "Still have questions?": the shop's phone and email (only those it
/// publishes) and the way to the contact page, as /store/faq's sidebar.
class FaqHelpCard extends StatelessWidget {
  const FaqHelpCard({super.key, required this.contact});

  final ShopContact contact;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(Icons.forum_outlined, size: AppSpacing.iconMd, color: context.colors.primary),
          const SizedBox(height: AppSpacing.md),
          Text(SupportStrings.stillHaveQuestions, style: context.text.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          Text(
            SupportStrings.stillHaveQuestionsBody,
            style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
          ),
          if (contact.phone.isNotEmpty)
            ContactDetailTile(
              icon: Icons.phone_outlined,
              label: SupportStrings.callUs,
              value: contact.phone,
              channel: ContactChannel.phone,
            ),
          if (contact.email.isNotEmpty)
            ContactDetailTile(
              icon: Icons.mail_outline,
              label: SupportStrings.emailUs,
              value: contact.email,
              channel: ContactChannel.email,
            ),
          const SizedBox(height: AppSpacing.md),
          AppButton(
            label: SupportStrings.contactSupport,
            icon: Icons.arrow_forward,
            onPressed: () => context.push(AppRoutes.contact),
          ),
        ],
      ),
    );
  }
}
