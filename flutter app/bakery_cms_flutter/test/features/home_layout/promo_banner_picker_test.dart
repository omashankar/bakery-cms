import 'package:bakery_cms_flutter/features/home_layout/domain/entities/banner_layout.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/banners_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/hero_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_banner.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_layout.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/products_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/services/promo_banner_picker.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const hero = HomeBanner(imageUrl: 'https://cdn.example/hero.jpg');
  const promo = HomeBanner(imageUrl: 'https://cdn.example/promo.jpg');
  const blank = HomeBanner(imageUrl: '  ');

  test('nothing when the app holds no layout, or one without pictures', () {
    expect(PromoBannerPicker.pick(null), isNull);
    expect(
      PromoBannerPicker.pick(
        const HomeLayout(
          sections: [ProductsSection(id: 'p', productSlugs: [])],
        ),
      ),
      isNull,
    );
  });

  test('the first picture in page order, a hero slide or a banner', () {
    expect(
      PromoBannerPicker.pick(
        const HomeLayout(
          sections: [
            ProductsSection(id: 'p', productSlugs: []),
            BannersSection(id: 'b', layout: BannerLayout.grid, items: [promo]),
            HeroSection(id: 'h', slides: [hero]),
          ],
        ),
      ),
      promo,
    );
    expect(
      PromoBannerPicker.pick(
        const HomeLayout(
          sections: [
            HeroSection(id: 'h', slides: [hero]),
            BannersSection(id: 'b', layout: BannerLayout.grid, items: [promo]),
          ],
        ),
      ),
      hero,
    );
  });

  test('skips a picture with no address and an empty band', () {
    expect(
      PromoBannerPicker.pick(
        const HomeLayout(
          sections: [
            HeroSection(id: 'h', slides: []),
            BannersSection(id: 'b', layout: BannerLayout.strip, items: [blank, promo]),
          ],
        ),
      ),
      promo,
    );
  });
}
