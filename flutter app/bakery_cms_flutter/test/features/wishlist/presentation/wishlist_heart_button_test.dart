import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/wishlist_strings.dart';
import 'package:bakery_cms_flutter/features/wishlist/data/datasources/wishlist_local_data_source.dart';
import 'package:bakery_cms_flutter/features/wishlist/data/repositories/wishlist_repository_impl.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/remove_from_wishlist.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/toggle_wishlist.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/watch_wishlist.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/widgets/wishlist_heart_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

class _MemorySource implements WishlistLocalDataSource {
  List<String> saved = const [];

  @override
  List<String> read() => saved;

  @override
  Future<void> write(List<String> slugs) async => saved = slugs;
}

void main() {
  late _MemorySource source;
  late WishlistRepositoryImpl repository;

  setUp(() {
    source = _MemorySource();
    repository = WishlistRepositoryImpl(source);
  });

  /// The provider makes and closes the cubit inside the test's fake-async
  /// zone. One made in setUp listens in the real zone, so a pump never
  /// delivers its changes and closing it in tearDown never finishes.
  Future<void> pumpHeart(WidgetTester tester, {double? size}) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: Center(
            child: BlocProvider(
              create: (_) => WishlistCubit(
                watchWishlist: WatchWishlist(repository),
                toggleWishlist: ToggleWishlist(repository),
                removeFromWishlist: RemoveFromWishlist(repository),
              )..start(),
              child: size == null
                  ? const WishlistHeartButton(productSlug: 'truffle')
                  : WishlistHeartButton(productSlug: 'truffle', size: size),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('a tap saves the product, a second tap forgets it', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpHeart(tester);

    expect(find.bySemanticsLabel(WishlistStrings.add), findsOneWidget);
    expect(find.byIcon(Icons.favorite_border), findsOneWidget);

    await tester.tap(find.byType(WishlistHeartButton));
    await tester.pump();

    expect(source.saved, ['truffle']);
    expect(find.bySemanticsLabel(WishlistStrings.remove), findsOneWidget);
    expect(find.bySemanticsLabel(WishlistStrings.add), findsNothing);
    expect(find.byIcon(Icons.favorite), findsOneWidget);
    expect(
      tester.getSemantics(find.bySemanticsLabel(WishlistStrings.remove)),
      containsSemantics(label: WishlistStrings.remove, isButton: true, hasTapAction: true),
    );

    await tester.tap(find.byType(WishlistHeartButton));
    await tester.pump();

    expect(source.saved, isEmpty);
    expect(find.bySemanticsLabel(WishlistStrings.add), findsOneWidget);
    expect(find.byIcon(Icons.favorite_border), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('a product saved elsewhere shows a filled heart', (tester) async {
    await repository.toggle('truffle');
    await pumpHeart(tester);

    expect(find.byIcon(Icons.favorite), findsOneWidget);
  });

  testWidgets('the tap target is at least 48dp even when the chip is small', (tester) async {
    await pumpHeart(tester, size: 24);

    final box = tester.getSize(find.byType(WishlistHeartButton));
    expect(box.width, greaterThanOrEqualTo(kMinInteractiveDimension));
    expect(box.height, greaterThanOrEqualTo(kMinInteractiveDimension));
  });
}
