import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../domain/entities/faq_item.dart';
import 'faq_tile.dart';

/// The questions, one open at a time, the first open to begin with: the
/// website's `FaqList` (`openFirst = 1`, and `name` grouping the items so
/// opening one closes the others). Give it a key that changes with the
/// list, so a new search or category opens its own top match.
class FaqAccordion extends StatefulWidget {
  const FaqAccordion({super.key, required this.faqs});

  final List<FaqItem> faqs;

  @override
  State<FaqAccordion> createState() => _FaqAccordionState();
}

class _FaqAccordionState extends State<FaqAccordion> {
  late String? _openId = widget.faqs.isEmpty ? null : widget.faqs.first.id;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final faq in widget.faqs)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: FaqTile(
              key: ValueKey('faq-${faq.id}'),
              faq: faq,
              open: faq.id == _openId,
              onToggle: () => setState(() => _openId = faq.id == _openId ? null : faq.id),
            ),
          ),
      ],
    );
  }
}
