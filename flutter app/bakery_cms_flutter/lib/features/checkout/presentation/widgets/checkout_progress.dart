import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../bloc/checkout_step.dart';

/// Cart → Address → Personalize → Payment: numbered circles joined by a
/// line, the name under each, as the website's checkout header draws them.
///
/// Done steps show a tick and, given [onSelect], go back there; later steps
/// cannot be jumped to, as on the website (they depend on the ones before).
class CheckoutProgress extends StatelessWidget {
  const CheckoutProgress({super.key, required this.current, this.onSelect});

  final CheckoutStep current;
  final ValueChanged<CheckoutStep>? onSelect;

  static const double dotSize = 28;
  static const double _lineThickness = 2;

  @override
  Widget build(BuildContext context) {
    const steps = CheckoutStep.values;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final step in steps)
          Expanded(
            child: _StepCell(
              step: step,
              current: current,
              isFirst: step == steps.first,
              isLast: step == steps.last,
              onSelect: onSelect,
            ),
          ),
      ],
    );
  }
}

class _StepCell extends StatelessWidget {
  const _StepCell({
    required this.step,
    required this.current,
    required this.isFirst,
    required this.isLast,
    required this.onSelect,
  });

  final CheckoutStep step;
  final CheckoutStep current;
  final bool isFirst;
  final bool isLast;
  final ValueChanged<CheckoutStep>? onSelect;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final done = step.index < current.index;
    final isCurrent = step == current;
    final reached = done || isCurrent;
    final select = onSelect;
    final tap = done && select != null ? () => select(step) : null;

    // The line into this step is coloured once the step is reached, the line
    // out of it once the next one is.
    final lineIn = reached ? colors.primary : colors.outlineVariant;
    final lineOut = done ? colors.primary : colors.outlineVariant;

    final number = '${step.index + 1}';
    final dot = Container(
      width: CheckoutProgress.dotSize,
      height: CheckoutProgress.dotSize,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: reached ? colors.primary : colors.surfaceContainerHighest,
      ),
      child: done
          ? Icon(Icons.check, size: AppSpacing.iconSm, color: colors.onPrimary)
          : Text(
              number,
              style: context.text.labelLarge?.copyWith(
                color: isCurrent ? colors.onPrimary : colors.onSurfaceVariant,
              ),
            ),
    );

    return Semantics(
      button: tap != null,
      selected: isCurrent,
      label: CheckoutStrings.stepOf(step.index + 1, CheckoutStep.values.length, step.label),
      excludeSemantics: true,
      child: InkWell(
        onTap: tap,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: CheckoutProgress.dotSize,
              child: Row(
                children: [
                  Expanded(child: _Line(color: isFirst ? null : lineIn)),
                  dot,
                  Expanded(child: _Line(color: isLast ? null : lineOut)),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              step.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: context.text.labelMedium?.copyWith(
                color: isCurrent ? colors.onSurface : colors.onSurfaceVariant,
                fontWeight: isCurrent ? FontWeight.w600 : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Half of the line joining two steps; nothing before the first or after
/// the last.
class _Line extends StatelessWidget {
  const _Line({required this.color});

  final Color? color;

  @override
  Widget build(BuildContext context) {
    final lineColor = color;
    if (lineColor == null) return const SizedBox.shrink();
    return Container(height: CheckoutProgress._lineThickness, color: lineColor);
  }
}
