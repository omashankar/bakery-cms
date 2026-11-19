import 'package:flutter/material.dart';

import '../../../../app/theme/section_tones.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/home_section.dart';
import '../../domain/services/home_catalog_index.dart';
import '../utils/link_opener.dart';
import '../utils/storefront_link.dart';

/// A home section's ground, heading and "View all", around its [child].
///
/// White and cream run edge to edge; the tinted tones are a rounded card
/// inset from the edges, as on the website.
class SectionBand extends StatelessWidget {
  const SectionBand({
    super.key,
    required this.section,
    required this.index,
    required this.child,
    this.showHeading = true,
  });

  final HomeSection section;
  final HomeCatalogIndex index;
  final Widget child;
  final bool showHeading;

  @override
  Widget build(BuildContext context) {
    final tones = SectionTones.of(context);
    final ground = tones.groundOf(section.tone);
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showHeading)
          _Heading(section: section, index: index, pill: tones.strongOf(section.tone)),
        child,
      ],
    );

    if (section.tone.isPanel) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: ground,
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          child: Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: content,
          ),
        ),
      );
    }
    return ColoredBox(
      color: ground ?? Colors.transparent,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        child: content,
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading({required this.section, required this.index, this.pill});

  final HomeSection section;
  final HomeCatalogIndex index;
  final Color? pill;

  @override
  Widget build(BuildContext context) {
    final overline = section.overline;
    final title = section.title;
    final description = section.description;
    final cta = section.cta;
    final route = StorefrontLink.route(cta?.href, index);
    if (overline == null && title == null && description == null && route == null) {
      return const SizedBox(height: AppSpacing.sm);
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (overline != null)
                  Text(
                    overline,
                    style: context.text.labelMedium?.copyWith(color: context.colors.primary),
                  ),
                if (title != null) Text(title, style: context.text.titleMedium),
                if (description != null)
                  Text(
                    description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                  ),
              ],
            ),
          ),
          if (cta != null && route != null)
            Padding(
              padding: const EdgeInsets.only(left: AppSpacing.sm),
              child: TextButton(
                style: pill == null
                    ? null
                    : TextButton.styleFrom(
                        backgroundColor: pill,
                        foregroundColor: context.colors.onSurface,
                        shape: const StadiumBorder(),
                      ),
                onPressed: () => LinkOpener.open(context, route),
                // One line, always: a two-word label wrapping to two lines is
                // the broken button the reference page shows.
                child: Text(cta.label, maxLines: 1, softWrap: false),
              ),
            ),
        ],
      ),
    );
  }
}
