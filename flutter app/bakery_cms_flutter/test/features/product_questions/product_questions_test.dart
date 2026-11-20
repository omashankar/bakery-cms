import 'dart:convert';
import 'dart:io';

import 'package:bakery_cms_flutter/core/constants/strings/questions_strings.dart';
import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/core/network/api_envelope.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/product_questions/data/datasources/product_questions_remote_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/product_questions/data/models/product_question_model.dart';
import 'package:bakery_cms_flutter/features/product_questions/data/repositories/product_questions_repository_impl.dart';
import 'package:bakery_cms_flutter/features/product_questions/domain/entities/product_question.dart';
import 'package:bakery_cms_flutter/features/product_questions/domain/entities/question_draft.dart';
import 'package:bakery_cms_flutter/features/product_questions/domain/usecases/ask_product_question.dart';
import 'package:bakery_cms_flutter/features/product_questions/domain/usecases/get_product_questions.dart';
import 'package:bakery_cms_flutter/features/product_questions/presentation/bloc/ask/ask_question_cubit.dart';
import 'package:bakery_cms_flutter/features/product_questions/presentation/bloc/questions/product_questions_cubit.dart';
import 'package:bakery_cms_flutter/features/product_questions/presentation/widgets/product_questions_section.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockClient extends Mock implements ApiClient {}

class _MockGet extends Mock implements GetProductQuestions {}

class _MockAsk extends Mock implements AskProductQuestion {}

void main() {
  setUpAll(
    () => registerFallbackValue(
      const QuestionDraft(productSlug: '', productName: '', name: '', email: '', question: ''),
    ),
  );

  group('reading', () {
    test('the live answer (captured 2026-11-19) is an empty list', () {
      final raw = File('test/fixtures/website/api_questions.json').readAsStringSync();
      expect(ApiEnvelope.unwrap(jsonDecode(raw)), isEmpty);
    });

    test('an answered row, as listAnsweredForProduct selects it', () {
      // The server selects name, message, answer, answeredAt and createdAt.
      final question = ProductQuestionModel.fromJson({
        'id': 'inq-1',
        'name': 'Asha',
        'message': ' Is it eggless? ',
        'answer': 'Yes, on request.',
        'answeredAt': '2026-11-10T08:00:00.000Z',
        'createdAt': '2026-11-09T08:00:00.000Z',
      }).toEntity()!;
      expect(question.question, 'Is it eggless?');
      expect(question.answer, 'Yes, on request.');
      expect(question.name, 'Asha');
      expect(question.answeredAt, DateTime.utc(2026, 11, 10, 8));
    });

    test('a row with no answer is not public', () {
      expect(
        ProductQuestionModel.fromJson({'id': 'x', 'name': 'A', 'message': 'Q?'}).toEntity(),
        isNull,
      );
    });

    test('asks with the website\'s path and query', () async {
      final client = _MockClient();
      when(
        () => client.get('/api/inquiries/questions', query: {'productSlug': 'cake'}),
      ).thenAnswer((_) async => <Object>[]);
      final remote = ProductQuestionsRemoteDataSourceImpl(client);
      expect(await remote.fetchAnswered('cake'), isEmpty);
    });
  });

  test('the enquiry body is the website form\'s', () {
    expect(
      ProductQuestionsRepositoryImpl.bodyOf(
        const QuestionDraft(
          productSlug: 'mango-cake',
          productName: 'Mango Cake',
          name: ' Asha ',
          email: ' asha@example.com ',
          question: ' Is it eggless? ',
        ),
      ),
      {
        'type': 'product',
        'name': 'Asha',
        'email': 'asha@example.com',
        'subject': 'Question about Mango Cake',
        'message': 'Is it eggless?',
        'productSlug': 'mango-cake',
      },
    );
  });

  group('the questions cubit', () {
    const answered = ProductQuestion(id: '1', name: 'A', question: 'Q?', answer: 'Yes');

    test('loads the answered questions', () async {
      final get = _MockGet();
      when(() => get('cake')).thenAnswer((_) async => const Right([answered]));
      final cubit = ProductQuestionsCubit(get);
      await cubit.load('cake');
      expect(cubit.state.status, ViewStatus.success);
      expect(cubit.state.questions, [answered]);
      await cubit.close();
    });

    test('a failed first read is a failure', () async {
      final get = _MockGet();
      when(() => get('cake')).thenAnswer((_) async => const Left(NetworkFailure()));
      final cubit = ProductQuestionsCubit(get);
      await cubit.load('cake');
      expect(cubit.state.status, ViewStatus.failure);
      await cubit.close();
    });

    test('the summary line, as the website words it', () {
      expect(ProductQuestionsSection.summary(0), 'Ask the shop about this product');
      expect(ProductQuestionsSection.summary(1), '1 answered question');
      expect(ProductQuestionsSection.summary(3), '3 answered questions');
    });
  });

  group('the ask form (POST mocked)', () {
    late _MockAsk ask;

    setUp(() => ask = _MockAsk());

    Future<void> send(AskQuestionCubit cubit) =>
        cubit.submit(productSlug: 'cake', productName: 'Cake');

    test('name, email and question are all required', () async {
      final cubit = AskQuestionCubit(ask)
        ..nameChanged('Asha')
        ..questionChanged('Eggless?');
      await send(cubit);
      expect(cubit.state.errorMessage, QuestionsStrings.formMissing);
      cubit.emailChanged('asha@');
      await send(cubit);
      expect(cubit.state.errorMessage, QuestionsStrings.formBadEmail);
      verifyNever(() => ask(any()));
    });

    test('sent: the question clears, the name and email stay', () async {
      when(() => ask(any())).thenAnswer((_) async => const Right(unit));
      final cubit = AskQuestionCubit(ask)
        ..nameChanged('Asha')
        ..emailChanged('asha@example.com')
        ..questionChanged('Eggless?');
      await send(cubit);
      expect(cubit.state.status, ViewStatus.success);
      expect(cubit.state.sent, 1);
      expect(cubit.state.question, '');
      expect(cubit.state.name, 'Asha');
      expect(cubit.state.email, 'asha@example.com');
      final draft = verify(() => ask(captureAny())).captured.single as QuestionDraft;
      expect(draft.productSlug, 'cake');
    });

    test('a failed send says so and keeps the question', () async {
      when(() => ask(any())).thenAnswer((_) async => const Left(NetworkFailure()));
      final cubit = AskQuestionCubit(ask)
        ..nameChanged('Asha')
        ..emailChanged('asha@example.com')
        ..questionChanged('Eggless?');
      await send(cubit);
      expect(cubit.state.errorMessage, QuestionsStrings.formFailed);
      expect(cubit.state.question, 'Eggless?');
    });
  });
}
