import 'package:flutter/foundation.dart';

import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/product_question_model.dart';
import 'product_questions_remote_data_source.dart';

/// The website's `fetchProductQuestions` and `createInquiryRequest`.
class ProductQuestionsRemoteDataSourceImpl implements ProductQuestionsRemoteDataSource {
  const ProductQuestionsRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  static const String questionsPath = '/api/inquiries/questions';
  static const String inquiriesPath = '/api/inquiries';
  static const String productSlugQuery = 'productSlug';

  @override
  Future<List<ProductQuestionModel>> fetchAnswered(String productSlug) async {
    final data = await _client.get(questionsPath, query: {productSlugQuery: productSlug});
    if (data is! List) throw const ServerException();
    final questions = <ProductQuestionModel>[];
    for (final item in data.whereType<Map<String, dynamic>>()) {
      try {
        questions.add(ProductQuestionModel.fromJson(item));
      } catch (error) {
        debugPrint('Skipped a question that could not be read: $error');
      }
    }
    return questions;
  }

  @override
  Future<void> ask(Map<String, dynamic> body) async {
    await _client.post(inquiriesPath, body: body);
  }
}
