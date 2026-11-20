import 'package:bakery_cms_flutter/core/error/server_exception.dart';
import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/features/support/data/datasources/support_remote_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/support/data/models/inquiry_request_model.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/contact_message.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  late _MockApiClient client;
  late SupportRemoteDataSourceImpl source;

  setUp(() {
    client = _MockApiClient();
    source = SupportRemoteDataSourceImpl(client);
  });

  test('FAQs: only published ones with a question reach the app', () async {
    when(() => client.get('/api/content/faq')).thenAnswer(
      (_) async => [
        {'id': '1', 'question': 'Q1', 'answer': 'A', 'status': 'published', 'sortOrder': 2},
        {'id': '2', 'question': 'Q2', 'answer': 'A', 'status': 'draft', 'sortOrder': 1},
        {'id': '3', 'question': '  ', 'answer': 'A', 'status': 'published', 'sortOrder': 3},
      ],
    );
    final faqs = await source.fetchFaqs();
    expect(faqs.map((f) => f.id), ['1']);
  });

  test('a page is asked for by its encoded slug on the public route', () async {
    when(() => client.get(any())).thenAnswer(
      (_) async => {'slug': 'a b', 'title': 'T', 'description': '', 'blocks': <Object>[]},
    );
    await source.fetchPage('a b');
    verify(() => client.get('/api/storefront/pages/a%20b')).called(1);
  });

  test('an unexpected payload is a ServerException, not a crash', () async {
    when(() => client.get(any())).thenAnswer((_) async => 'nope');
    await expectLater(source.fetchContact(), throwsA(isA<ServerException>()));
    await expectLater(source.fetchFaqs(), throwsA(isA<ServerException>()));
  });

  test('the contact form posts its body to /api/inquiries', () async {
    when(() => client.post(any(), body: any(named: 'body'))).thenAnswer((_) async => {'id': 'i'});
    final request = InquiryRequestModel.fromEntity(
      const ContactMessage(name: 'Riya', email: 'riya@example.com', message: 'Hello'),
    );

    await source.sendInquiry(request);

    final captured = verify(
      () => client.post('/api/inquiries', body: captureAny(named: 'body')),
    ).captured;
    expect(captured.single, request.toJson());
  });
}
