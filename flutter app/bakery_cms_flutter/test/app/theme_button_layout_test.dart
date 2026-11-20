import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The theme once gave every filled/outlined button `Size.fromHeight(48)`,
/// an INFINITE minimum width. Any such button in a Row then could not be laid
/// out, and the sign-in page (reached from Checkout) rendered nothing.
void main() {
  Widget host(Widget child) => MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: child),
      );

  testWidgets('a primary and a secondary button sit side by side in a Row', (tester) async {
    await tester.pumpWidget(host(
      Row(
        children: [
          AppButton(label: 'Resend', onPressed: () {}, expand: false),
          AppButton.secondary(label: 'Change email', onPressed: () {}, expand: false),
        ],
      ),
    ));
    expect(tester.takeException(), isNull);
    expect(find.text('Resend'), findsOneWidget);
  });

  testWidgets('expand still makes a button full width', (tester) async {
    await tester.pumpWidget(host(AppButton(label: 'Checkout', onPressed: () {})));
    final button = tester.getSize(find.byType(FilledButton));
    expect(button.width, tester.view.physicalSize.width / tester.view.devicePixelRatio);
  });
}
