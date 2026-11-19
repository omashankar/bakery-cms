import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/constants/strings/questions_strings.dart';
import '../../../../../core/utils/validators.dart';
import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/question_draft.dart';
import '../../../domain/usecases/ask_product_question.dart';
import 'ask_question_state.dart';

/// The website's question form (`product-question-form.tsx`): name, email
/// and question all required, the email a real one, since that is where the
/// answer goes. No sign-in, as on the website.
class AskQuestionCubit extends Cubit<AskQuestionState> {
  AskQuestionCubit(this._ask) : super(const AskQuestionState());

  final AskProductQuestion _ask;

  void nameChanged(String value) => emit(state.copyWith(name: value, status: _editing));
  void emailChanged(String value) => emit(state.copyWith(email: value, status: _editing));
  void questionChanged(String value) => emit(state.copyWith(question: value, status: _editing));

  ViewStatus get _editing => state.status.isFailure ? ViewStatus.initial : state.status;

  Future<void> submit({required String productSlug, required String productName}) async {
    if (state.status.isLoading) return;
    if (state.name.trim().isEmpty || state.email.trim().isEmpty || state.question.trim().isEmpty) {
      emit(state.copyWith(status: ViewStatus.failure, errorMessage: QuestionsStrings.formMissing));
      return;
    }
    if (Validators.email(state.email) != null) {
      emit(state.copyWith(status: ViewStatus.failure, errorMessage: QuestionsStrings.formBadEmail));
      return;
    }
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _ask(
      QuestionDraft(
        productSlug: productSlug,
        productName: productName,
        name: state.name,
        email: state.email,
        question: state.question,
      ),
    );
    if (isClosed) return;
    result.match(
      (_) => emit(
        state.copyWith(status: ViewStatus.failure, errorMessage: QuestionsStrings.formFailed),
      ),
      // The question goes; the name and email stay for the next one, as on
      // the website.
      (_) => emit(
        AskQuestionState(
          status: ViewStatus.success,
          name: state.name,
          email: state.email,
          sent: state.sent + 1,
        ),
      ),
    );
  }
}
