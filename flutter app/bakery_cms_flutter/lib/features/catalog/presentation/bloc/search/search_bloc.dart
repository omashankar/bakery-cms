import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/constants/app_durations.dart';
import '../../../../../core/utils/view_status.dart';
import '../../../domain/usecases/search_products.dart';
import 'search_event.dart';
import 'search_state.dart';

/// Search as you type. `restartable` drops a search the moment the next key
/// arrives, and the pause before searching is the debounce.
class SearchBloc extends Bloc<SearchEvent, SearchState> {
  SearchBloc(this._searchProducts, {Duration debounce = AppDurations.searchDebounce})
    : _debounce = debounce,
      super(const SearchState()) {
    on<SearchQueryChanged>(_onQueryChanged, transformer: restartable());
  }

  final SearchProducts _searchProducts;
  final Duration _debounce;

  Future<void> _onQueryChanged(SearchQueryChanged event, Emitter<SearchState> emit) async {
    final query = event.query.trim();
    if (query.isEmpty) {
      emit(const SearchState());
      return;
    }
    emit(state.copyWith(status: ViewStatus.loading, query: query));
    await Future<void>.delayed(_debounce);
    if (emit.isDone) return;

    final result = await _searchProducts(query);
    if (emit.isDone) return;
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (products) => emit(state.copyWith(status: ViewStatus.success, results: products)),
    );
  }
}
