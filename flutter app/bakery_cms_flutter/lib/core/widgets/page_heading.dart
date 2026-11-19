import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';
import '../utils/context_extensions.dart';

/// A page's own name, at the top of its content: "Shopping Cart (3)",
/// "My orders". The header above carries the shop's brand, as on the
/// website, so the page says what it is here, once.
class PageHeading extends StatelessWidget {
  const PageHeading(this.text, {super.key, this.padded = true});

  final String text;

  /// With the page's side margins; false inside a list that already has them.
  final bool padded;

  @override
  Widget build(BuildContext context) {
    final heading = Semantics(
      header: true,
      child: Text(text, style: context.text.titleLarge),
    );
    if (!padded) return heading;
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.sm),
      child: heading,
    );
  }
}
