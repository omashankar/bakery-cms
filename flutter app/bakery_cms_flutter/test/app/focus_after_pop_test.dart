import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// Seen on a phone: typing in a checkout field, then opening the map and
/// coming back, put the keyboard straight back up on that field.
void main() {
  Future<FocusNode> openAndClose(WidgetTester tester, void Function() unfocus) async {
    final field = FocusNode();
    // The app's shape: the map is a CHILD route of checkout (/checkout/map).
    final router = GoRouter(
      initialLocation: '/checkout',
      routes: [
        GoRoute(path: '/', builder: (_, _) => const SizedBox.shrink()),
        GoRoute(
          path: '/checkout',
          routes: [
            GoRoute(
              path: 'map',
              builder: (context, _) => Scaffold(
                body: TextButton(onPressed: () => context.pop(), child: const Text('back')),
              ),
            ),
          ],
          builder: (context, _) => Scaffold(
            body: Column(
              children: [
                TextField(focusNode: field),
                TextButton(
                  onPressed: () {
                    unfocus();
                    context.push('/checkout/map');
                  },
                  child: const Text('map'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.tap(find.byType(TextField));
    await tester.pumpAndSettle();
    expect(field.hasFocus, isTrue);

    await tester.tap(find.text('map'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('back'));
    await tester.pumpAndSettle();
    return field;
  }

  testWidgets('unfocusing the field itself keeps it unfocused after the pop', (tester) async {
    final field = await openAndClose(
      tester,
      () => FocusManager.instance.primaryFocus?.unfocus(),
    );
    expect(field.hasFocus, isFalse);
  });
}
