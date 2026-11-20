import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/strings/support_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/shop_page.dart';

/// "By continuing, you agree to our Terms of Service and Privacy Policy",
/// under the sign-in form, both linked, as the website's sign-in dialog has
/// it.
class LegalLinksLine extends StatelessWidget {
  const LegalLinksLine({super.key});

  @override
  Widget build(BuildContext context) {
    final base = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    final link = base?.copyWith(color: context.colors.primary, fontWeight: FontWeight.w600);
    Widget linkTo(String label, String slug) => InkWell(
      onTap: () => context.push(AppRoutes.page(slug)),
      child: Text(label, style: link),
    );
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(SupportStrings.agreePrefix, style: base),
        linkTo(SupportStrings.termsTile, ShopPage.termsSlug),
        Text(SupportStrings.agreeJoin, style: base),
        linkTo(SupportStrings.privacyTile, ShopPage.privacySlug),
      ],
    );
  }
}
