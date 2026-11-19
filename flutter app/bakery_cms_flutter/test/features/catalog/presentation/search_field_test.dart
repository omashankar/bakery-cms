import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/catalog_strings.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/search_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Future<List<String>> pump(WidgetTester tester, {String initial = ''}) async {
    final changes = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: SearchField(initialQuery: initial, onChanged: changes.add),
        ),
      ),
    );
    return changes;
  }

  testWidgets('a hint, never a floating label squeezed against the bar', (tester) async {
    await pump(tester);
    final decoration = tester.widget<TextField>(find.byType(TextField)).decoration!;
    expect(decoration.labelText, isNull);
    expect(decoration.label, isNull);
    expect(find.text(CatalogStrings.searchHint), findsOneWidget);
  });

  testWidgets('clear appears once there is text, and empties the search', (tester) async {
    final changes = await pump(tester);
    expect(find.byTooltip(CatalogStrings.clearSearch), findsNothing);

    await tester.enterText(find.byType(TextField), 'truffle');
    await tester.pump();
    expect(find.byTooltip(CatalogStrings.clearSearch), findsOneWidget);

    await tester.tap(find.byTooltip(CatalogStrings.clearSearch));
    await tester.pump();
    expect(find.text('truffle'), findsNothing);
    expect(changes, ['truffle', '']);
    expect(find.byTooltip(CatalogStrings.clearSearch), findsNothing);
  });

  testWidgets('opened with a query, it shows it and can clear it', (tester) async {
    await pump(tester, initial: 'red velvet');
    expect(find.text('red velvet'), findsOneWidget);
    expect(find.byTooltip(CatalogStrings.clearSearch), findsOneWidget);
  });
}
