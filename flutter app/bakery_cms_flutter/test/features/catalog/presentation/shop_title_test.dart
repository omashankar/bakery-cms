import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/widgets/app_app_bar.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/shop_title.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_config.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../checkout/checkout_fixtures.dart' as checkout;
import '../app_cubits_harness.dart';

const _logo = 'https://res.cloudinary.com/demo/image/upload/v1/bakery-cms/logo.webp';

StoreConfig _shop({String logo = ''}) => StoreConfig(
  siteName: checkout.config.siteName,
  tagline: '',
  logoUrl: logo,
  currency: 'INR',
  deliveryFee: 99,
  freeDeliveryThreshold: 999,
  minOrderValue: 0,
  useZoneBasedDelivery: true,
  deliveryLeadDays: 0,
  sameDayCutoff: '',
  deliveryTimeSlots: const [],
  deliveryTiers: const [],
  giftWrapEnabled: false,
  giftWrapFee: 0,
  giftWrapLabel: '',
  checkoutTerms: '',
  paymentMethods: checkout.config.paymentMethods,
  maintenanceEnabled: false,
  maintenanceMessage: '',
);

void main() {
  /// The busiest header: back, the brand, then search, wishlist and cart.
  Future<void> pumpHeader(WidgetTester tester, {required double width, String logo = ''}) async {
    tester.view
      ..physicalSize = Size(width, 800)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      withAppCubits(
        settings: _shop(logo: logo),
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            appBar: AppAppBar(
              titleWidget: const ShopTitle(),
              leading: const BackButton(),
              actions: [
                for (final icon in const [Icons.search, Icons.favorite_border, Icons.shopping_bag])
                  IconButton(onPressed: () {}, icon: Icon(icon)),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  RenderParagraph name(WidgetTester tester) =>
      tester.renderObject<RenderParagraph>(find.text(checkout.config.siteName));

  group('a shop without a logo: its name', () {
    testWidgets('fits on one line where there is room', (tester) async {
      await pumpHeader(tester, width: 600);
      expect(name(tester).didExceedMaxLines, isFalse);
      expect(tester.widget<Text>(find.text(checkout.config.siteName)).maxLines, 1);
    });

    testWidgets('beside three icons on a phone, is set over two lines, never cut', (
      tester,
    ) async {
      // The test font draws every letter a full em wide, so 480 here is a
      // phone's 360 with real letters: too narrow for one line at the title's
      // size, room for two at the smaller one.
      await pumpHeader(tester, width: 480);
      // "Sweet Crumbs…" is not the shop's name.
      expect(name(tester).didExceedMaxLines, isFalse);
      expect(tester.widget<Text>(find.text(checkout.config.siteName)).maxLines, 2);
      expect(tester.takeException(), isNull);
    });
  });

  group("a shop with a logo: the logo, as the website's header draws it", () {
    testWidgets('the logo, bounded to the bar, read aloud as the name', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpHeader(tester, width: 360, logo: _logo);

      final image = tester.widget<CachedNetworkImage>(find.byType(CachedNetworkImage));
      expect(image.imageUrl, contains('bakery-cms/logo.webp'));
      expect(image.height, ShopTitle.logoHeight);
      expect(image.fit, BoxFit.contain);
      expect(
        find.bySemanticsLabel(checkout.config.siteName),
        findsOneWidget,
        reason: 'a screen reader says the shop, not "image"',
      );
      semantics.dispose();
    });
  });
}
