/// The FAQ pills, in the website's order (`faqCategories` in
/// apps/website/pages/faq-page.tsx). [all] hides nothing; the others match an
/// FAQ's `category`.
enum FaqCategory {
  all(''),
  general('general'),
  orders('orders'),
  wedding('wedding'),
  delivery('delivery');

  const FaqCategory(this.apiValue);

  final String apiValue;

  /// The category an FAQ was filed under; one the app does not know is
  /// null, and shows only under [all].
  static FaqCategory? fromApi(String value) {
    for (final category in values) {
      if (category != all && category.apiValue == value) return category;
    }
    return null;
  }
}
