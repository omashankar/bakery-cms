import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/faq_category.dart';
import '../../domain/entities/faq_item.dart';
import '../../domain/entities/shop_contact.dart';
import '../../domain/services/faq_filter.dart';

class FaqState extends Equatable {
  const FaqState({
    this.status = ViewStatus.initial,
    this.faqs = const [],
    this.category = FaqCategory.all,
    this.query = '',
    this.contact = const ShopContact(),
    this.errorMessage,
  });

  final ViewStatus status;

  /// Every published FAQ, in the admin's order.
  final List<FaqItem> faqs;
  final FaqCategory category;
  final String query;

  /// For "Still have questions?". Empty when it could not be read: the
  /// card then offers only the contact page.
  final ShopContact contact;
  final String? errorMessage;

  /// What the list shows: [faqs] narrowed by [category] and [query].
  List<FaqItem> get visible => FaqFilter.apply(faqs, category: category, query: query);

  FaqState copyWith({
    ViewStatus? status,
    List<FaqItem>? faqs,
    FaqCategory? category,
    String? query,
    ShopContact? contact,
    String? errorMessage,
  }) {
    return FaqState(
      status: status ?? this.status,
      faqs: faqs ?? this.faqs,
      category: category ?? this.category,
      query: query ?? this.query,
      contact: contact ?? this.contact,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, faqs, category, query, contact, errorMessage];
}
