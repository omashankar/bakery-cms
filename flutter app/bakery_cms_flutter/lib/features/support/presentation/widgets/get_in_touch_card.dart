import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/support_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_card.dart';
import '../../domain/entities/contact_channel.dart';
import '../../domain/entities/shop_contact.dart';
import 'contact_detail_tile.dart';

/// "Get in Touch": only the ways this shop actually publishes, in the
/// website's order (address, phone, email). A tap on the phone calls it and
/// on the email writes to it, as the website's links do. The caller skips the card when
/// none is published.
class GetInTouchCard extends StatelessWidget {
  const GetInTouchCard({super.key, required this.contact});

  final ShopContact contact;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(SupportStrings.getInTouch, style: context.text.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          if (contact.address.isNotEmpty)
            ContactDetailTile(
              icon: Icons.location_on_outlined,
              label: SupportStrings.visitUs,
              value: contact.address,
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
        ],
      ),
    );
  }
}
