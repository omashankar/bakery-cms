import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';
import '../utils/context_extensions.dart';

/// A titled group of fields, as on checkout and account screens.
class FormSection extends StatelessWidget {
  const FormSection({super.key, required this.title, required this.children, this.trailing});

  final String title;
  final List<Widget> children;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: context.text.titleMedium)),
              ?trailing,
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          for (final child in children) ...[
            child,
            if (child != children.last) const SizedBox(height: AppSpacing.md),
          ],
        ],
      ),
    );
  }
}
