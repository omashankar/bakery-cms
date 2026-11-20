import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/app_spacing.dart';
import 'package:bakery_cms_flutter/core/widgets/app_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Found on the phone: the red "Remove" / "Yes, cancel" button was squashed
/// to the height of its label.
void main() {
  for (final destructive in [true, false]) {
    testWidgets('the confirm button is a full-height button (destructive: $destructive)',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Builder(
            builder: (context) => TextButton(
              onPressed: () => AppDialog.confirm(
                context,
                title: 'Remove item?',
                message: 'Gone',
                confirmLabel: 'Remove',
                destructive: destructive,
              ),
              child: const Text('open'),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      // The painted surface, not the button widget: Flutter pads every
      // button's box out to a 48dp tap target, so the box was 48 even while
      // the red surface inside it was squashed.
      final surface = find.descendant(
        of: find.ancestor(of: find.text('Remove'), matching: find.byType(FilledButton)),
        matching: find.byType(Material),
      );
      expect(tester.getSize(surface.first).height, greaterThanOrEqualTo(AppSpacing.buttonHeight));
    });
  }
}
