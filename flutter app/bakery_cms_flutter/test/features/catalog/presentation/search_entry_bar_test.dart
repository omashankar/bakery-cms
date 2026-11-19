import 'package:bakery_cms_flutter/core/constants/app_durations.dart';
import 'package:bakery_cms_flutter/core/constants/strings/catalog_strings.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/search_entry_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The home search box's hint turns through the shop's own words.
void main() {
  Future<void> pump(
    WidgetTester tester, {
    List<String> words = const [],
    bool reducedMotion = false,
    bool onScreen = true,
  }) => tester.pumpWidget(
    MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: reducedMotion),
        child: TickerMode(
          enabled: onScreen,
          child: Scaffold(body: SearchEntryBar(hintWords: words)),
        ),
      ),
    ),
  );

  /// One turn, and the cross-fade after it.
  Future<void> turn(WidgetTester tester) async {
    await tester.pump(AppDurations.searchHintTurn);
    await tester.pumpAndSettle();
  }

  testWidgets('no words: the fixed hint, and it stays', (tester) async {
    await pump(tester);
    expect(find.text(CatalogStrings.searchHint), findsOneWidget);
    await turn(tester);
    expect(find.text(CatalogStrings.searchHint), findsOneWidget);
  });

  testWidgets('the shop words take turns, "Search for <word>", and come round again', (
    tester,
  ) async {
    await pump(tester, words: const ['Cakes', 'Birthday']);
    expect(find.text('Search for Cakes'), findsOneWidget);
    await turn(tester);
    expect(find.text('Search for Birthday'), findsOneWidget);
    expect(find.text('Search for Cakes'), findsNothing);
    await turn(tester);
    expect(find.text('Search for Cakes'), findsOneWidget);
  });

  testWidgets('reduced motion: the fixed hint, never turning', (tester) async {
    await pump(tester, words: const ['Cakes', 'Birthday'], reducedMotion: true);
    expect(find.text(CatalogStrings.searchHint), findsOneWidget);
    await turn(tester);
    expect(find.text(CatalogStrings.searchHint), findsOneWidget);
    expect(find.textContaining(CatalogStrings.searchForPrefix), findsNothing);
  });

  testWidgets('off screen (tickers off): it does not turn', (tester) async {
    await pump(tester, words: const ['Cakes', 'Birthday'], onScreen: false);
    await turn(tester);
    expect(find.text('Search for Cakes'), findsOneWidget);
    expect(find.text('Search for Birthday'), findsNothing);
  });

  testWidgets('back on screen it turns again', (tester) async {
    await pump(tester, words: const ['Cakes', 'Birthday'], onScreen: false);
    await pump(tester, words: const ['Cakes', 'Birthday']);
    await turn(tester);
    expect(find.text('Search for Birthday'), findsOneWidget);
  });

  testWidgets('a single word shows without a timer', (tester) async {
    await pump(tester, words: const ['Cakes']);
    expect(find.text('Search for Cakes'), findsOneWidget);
    expect(tester.binding.transientCallbackCount, 0);
  });

  testWidgets('leaving the screen stops the timer: no pending timers after dispose', (
    tester,
  ) async {
    await pump(tester, words: const ['Cakes', 'Birthday']);
    await tester.pumpWidget(const SizedBox());
    // The test binding fails the test if a timer outlives the widget.
  });

  test('words are trimmed, blanks and repeats dropped, and capped', () {
    expect(SearchEntryBar.wordsOf([' Cakes ', '', 'cakes', 'Birthday', '  ']), [
      'Cakes',
      'Birthday',
    ]);
    final many = [for (var i = 0; i < 30; i++) 'Word $i'];
    expect(SearchEntryBar.wordsOf(many), hasLength(SearchEntryBar.maxHintWords));
  });
}
