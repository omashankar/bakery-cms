import 'package:bakery_cms_flutter/features/support/data/models/faq_item_model.dart';
import 'package:bakery_cms_flutter/features/support/data/models/inquiry_request_model.dart';
import 'package:bakery_cms_flutter/features/support/data/models/shop_contact_model.dart';
import 'package:bakery_cms_flutter/features/support/data/models/shop_page_model.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/contact_message.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/faq_category.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/page_block_type.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support_fixtures.dart';

/// Read from responses captured off the running shop, so a renamed field
/// on the server fails here rather than on a phone.
void main() {
  group('GET /api/content/faq (live capture)', () {
    final raw = (liveData('content_faq.json')! as List).cast<Map<String, dynamic>>();
    final faqs = raw.map(FaqItemModel.fromJson).toList();

    test('every published question is read, with its answer, category and order', () {
      expect(faqs, hasLength(raw.length));
      expect(faqs, isNotEmpty);
      for (final faq in faqs) {
        expect(faq.isPublished, isTrue);
        expect(faq.question, isNotEmpty);
        expect(faq.answer, isNotEmpty);
      }
      final first = faqs.first.toEntity();
      expect(first.id, raw.first['id']);
      expect(first.question, raw.first['question']);
      expect(first.sortOrder, raw.first['sortOrder']);
    });

    test('the categories are the website\'s four', () {
      final categories = faqs.map((faq) => faq.toEntity().category).toSet();
      expect(categories, isNot(contains(null)));
      expect(categories, containsAll([FaqCategory.wedding, FaqCategory.general]));
    });

    test('a draft is not published, and an unknown category is kept for "All" only', () {
      final draft = FaqItemModel.fromJson(const {
        'id': 'x',
        'question': 'Q',
        'answer': 'A',
        'category': 'seasonal',
        'status': 'draft',
        'sortOrder': 9,
      });
      expect(draft.isPublished, isFalse);
      expect(draft.toEntity().category, isNull);
    });
  });

  group('GET /api/storefront/contact (live capture)', () {
    final contact = ShopContactModel.fromJson(
      liveData('storefront_contact.json')! as Map<String, dynamic>,
    ).toEntity();

    test('reads the address, phone, email and opening hours', () {
      expect(contact.address, isNotEmpty);
      expect(contact.phone, isNotEmpty);
      expect(contact.email, contains('@'));
      expect(contact.openingHours, isNotEmpty);
      expect(contact.openingHours.first.day, isNotEmpty);
      expect(contact.openingHours.first.hours, isNotEmpty);
    });

    test('a shop that publishes nothing reads as empty, not as demo values', () {
      final empty = ShopContactModel.fromJson(const {
        'address': '',
        'phone': '',
        'email': '',
        'mapEmbedUrl': '',
        'businessHours': <Object>[],
      }).toEntity();
      expect(empty.isEmpty, isTrue);
    });
  });

  group('GET /api/storefront/pages/[slug] (live capture)', () {
    final page = ShopPageModel.fromJson(
      liveData('storefront_page_terms.json')! as Map<String, dynamic>,
    ).toEntity();

    test('reads the title and every block', () {
      expect(page.slug, 'terms');
      expect(page.title, 'Terms of Service');
      expect(page.blocks, isNotEmpty);
      expect(page.blocks.every((block) => block.content.isNotEmpty), isTrue);
    });

    test('a heading is a heading; any other type is a paragraph, as renderBlocks draws it', () {
      final odd = ShopPageModel.fromJson(const {
        'slug': 's',
        'title': 'T',
        'description': '',
        'blocks': [
          {'id': 'a', 'type': 'heading', 'content': 'H'},
          {'id': 'b', 'type': 'quote', 'content': 'Q'},
          {'id': 'c', 'type': 'paragraph', 'content': '   '},
        ],
      }).toEntity();
      expect(odd.blocks.map((b) => b.type), [PageBlockType.heading, PageBlockType.paragraph]);
    });
  });

  group('POST /api/inquiries body', () {
    test('is a "contact" inquiry, trimmed, with blank optional fields left out', () {
      final body = InquiryRequestModel.fromEntity(
        const ContactMessage(
          name: '  Riya Sharma ',
          email: ' riya@example.com ',
          message: ' Do you deliver to Borkhera? ',
          phone: '   ',
        ),
      ).toJson();
      expect(body, {
        'type': 'contact',
        'name': 'Riya Sharma',
        'email': 'riya@example.com',
        'message': 'Do you deliver to Borkhera?',
      });
    });

    test('carries the phone and subject when given', () {
      final body = InquiryRequestModel.fromEntity(
        const ContactMessage(
          name: 'Riya',
          email: 'riya@example.com',
          message: 'Hi',
          phone: '98765 43210',
          subject: 'Order inquiry',
        ),
      ).toJson();
      expect(body['phone'], '98765 43210');
      expect(body['subject'], 'Order inquiry');
    });
  });
}
