import '../models/product_question_model.dart';

abstract interface class ProductQuestionsRemoteDataSource {
  Future<List<ProductQuestionModel>> fetchAnswered(String productSlug);

  /// The JSON body the website's form sends to `/api/inquiries`.
  Future<void> ask(Map<String, dynamic> body);
}
