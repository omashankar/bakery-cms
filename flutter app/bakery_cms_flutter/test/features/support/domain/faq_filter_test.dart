import 'package:bakery_cms_flutter/features/support/domain/entities/faq_category.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/faq_item.dart';
import 'package:bakery_cms_flutter/features/support/domain/services/faq_filter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const faqs = [
    FaqItem(
      id: 'c',
      question: 'Do you deliver at midnight?',
      answer: 'Yes, between 11 PM and midnight.',
      category: FaqCategory.delivery,
      sortOrder: 3,
    ),
    FaqItem(
      id: 'a',
      question: 'Eggless cakes?',
      answer: 'Across all flavours.',
      category: FaqCategory.general,
      sortOrder: 1,
    ),
    FaqItem(
      id: 'b',
      question: 'Wedding tastings?',
      answer: 'Book two weeks ahead.',
      category: FaqCategory.wedding,
      sortOrder: 2,
    ),
    FaqItem(id: 'd', question: 'Gift cards?', answer: 'Soon.', category: null, sortOrder: 0),
  ];

  List<String> ids(List<FaqItem> items) => items.map((f) => f.id).toList();

  test('All shows every question in the admin\'s order', () {
    expect(ids(FaqFilter.apply(faqs)), ['d', 'a', 'b', 'c']);
  });

  test('a category shows only its own questions', () {
    expect(ids(FaqFilter.apply(faqs, category: FaqCategory.delivery)), ['c']);
    expect(FaqFilter.apply(faqs, category: FaqCategory.orders), isEmpty);
  });

  test('the search matches the question or the answer, ignoring case', () {
    expect(ids(FaqFilter.apply(faqs, query: 'EGGLESS')), ['a']);
    expect(ids(FaqFilter.apply(faqs, query: 'two weeks')), ['b']);
    expect(ids(FaqFilter.apply(faqs, query: '  ')), ['d', 'a', 'b', 'c']);
  });

  test('the search works inside the chosen category', () {
    expect(FaqFilter.apply(faqs, category: FaqCategory.general, query: 'midnight'), isEmpty);
  });
}
