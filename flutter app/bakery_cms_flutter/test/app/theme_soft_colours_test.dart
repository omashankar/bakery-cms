import 'dart:math' as math;

import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// WCAG contrast between two colours, 1 to 21.
double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

void main() {
  for (final (name, theme) in [('light', AppTheme.light), ('dark', AppTheme.dark)]) {
    final scheme = theme.colorScheme;
    final pairs = {
      'error': (scheme.error, scheme.errorContainer, scheme.onErrorContainer),
      'tertiary': (scheme.tertiary, scheme.tertiaryContainer, scheme.onTertiaryContainer),
      'primary': (scheme.primary, scheme.primaryContainer, scheme.onPrimaryContainer),
    };

    for (final MapEntry(key: role, value: (solid, ground, ink)) in pairs.entries) {
      test('$name: the $role notice ground is soft, not the solid $role colour', () {
        // Unset, Flutter falls back to the solid colour: a cancelled order's
        // notice was a slab of bright red.
        expect(ground, isNot(solid));
        expect(_contrast(ground, scheme.surface), lessThan(_contrast(solid, scheme.surface)));
      });

      test('$name: text on the $role ground is readable (4.5:1 or more)', () {
        expect(_contrast(ground, ink), greaterThanOrEqualTo(4.5));
      });
    }
  }
}
