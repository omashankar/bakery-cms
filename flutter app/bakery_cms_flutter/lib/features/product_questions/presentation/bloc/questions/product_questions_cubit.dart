import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/usecases/get_product_questions.dart';
import 'product_questions_state.dart';

/// "Questions and Answers" on a product page: the questions the shop has
/// answered. A failed re-read leaves what is on screen alone.
class ProductQuestionsCubit extends Cubit<ProductQuestionsState> {
  ProductQuestionsCubit(this._getQuestions) : super(const ProductQuestionsState());

  final GetProductQuestions _getQuestions;

  Future<void> load(String productSlug) async {
    if (state.status.isLoading) return;
    final hadList = state.status.isSuccess;
    if (!hadList) emit(state.copyWith(status: ViewStatus.loading));
    final result = await _getQuestions(productSlug);
    if (isClosed) return;
    result.match((failure) {
      if (!hadList) {
        emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message));
      }
    }, (questions) => emit(state.copyWith(status: ViewStatus.success, questions: questions)));
  }
}
