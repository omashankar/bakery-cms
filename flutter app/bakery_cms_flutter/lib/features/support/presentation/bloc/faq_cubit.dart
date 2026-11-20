import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/no_params.dart';
import '../../../../core/utils/view_status.dart';
import '../../domain/entities/faq_category.dart';
import '../../domain/usecases/get_faqs.dart';
import '../../domain/usecases/get_shop_contact.dart';
import 'faq_state.dart';

/// The FAQ screen: the published questions, a category and a search, like
/// /store/faq. The shop's phone and email ride along for the help card.
class FaqCubit extends Cubit<FaqState> {
  FaqCubit({required GetFaqs getFaqs, required GetShopContact getShopContact})
    : _getFaqs = getFaqs,
      _getShopContact = getShopContact,
      super(const FaqState());

  final GetFaqs _getFaqs;
  final GetShopContact _getShopContact;

  Future<void> load() async {
    if (state.status.isLoading) return;
    emit(state.copyWith(status: ViewStatus.loading));
    final contactRead = _getShopContact(const NoParams());
    final result = await _getFaqs(const NoParams());
    // The help card is extra: a failed read leaves it with only the link.
    final contact = (await contactRead).getRight().toNullable();
    if (isClosed) return;
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (faqs) => emit(state.copyWith(status: ViewStatus.success, faqs: faqs, contact: contact)),
    );
  }

  void selectCategory(FaqCategory category) => emit(state.copyWith(category: category));

  void search(String query) => emit(state.copyWith(query: query));
}
