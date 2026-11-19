import '../entities/faq_category.dart';
import '../entities/faq_item.dart';

/// The website's FAQ list rule (`selectStorefrontFaqs` and the page's search
/// box): the chosen category (or all), in the admin's sort order, then the
/// search matched case-insensitively against the question OR the answer.
abstract final class FaqFilter {
  static List<FaqItem> apply(
    List<FaqItem> faqs, {
    FaqCategory category = FaqCategory.all,
    String query = '',
  }) {
    final needle = query.trim().toLowerCase();
    final chosen =
        faqs.where((faq) => category == FaqCategory.all || faq.category == category).toList()
          ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    if (needle.isEmpty) return chosen;
    return chosen
        .where(
          (faq) =>
              faq.question.toLowerCase().contains(needle) ||
              faq.answer.toLowerCase().contains(needle),
        )
        .toList();
  }
}
