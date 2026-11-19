import '../../../../core/constants/strings/support_strings.dart';
import '../../domain/entities/faq_category.dart';

/// The pill's wording, as the website writes it.
extension FaqCategoryLabel on FaqCategory {
  String get label => switch (this) {
    FaqCategory.all => SupportStrings.faqAll,
    FaqCategory.general => SupportStrings.faqGeneral,
    FaqCategory.orders => SupportStrings.faqOrders,
    FaqCategory.wedding => SupportStrings.faqWedding,
    FaqCategory.delivery => SupportStrings.faqDelivery,
  };
}
