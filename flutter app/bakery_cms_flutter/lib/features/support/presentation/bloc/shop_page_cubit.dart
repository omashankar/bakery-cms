import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/error/server_failure.dart';
import '../../../../core/utils/view_status.dart';
import '../../domain/usecases/get_shop_page.dart';
import 'shop_page_state.dart';

/// One published CMS page (Privacy Policy, Terms of Service, …).
class ShopPageCubit extends Cubit<ShopPageState> {
  ShopPageCubit(this._getShopPage) : super(const ShopPageState());

  final GetShopPage _getShopPage;

  static const int _notFoundStatus = 404;

  Future<void> load(String slug) async {
    if (state.status.isLoading) return;
    emit(state.copyWith(status: ViewStatus.loading, notFound: false));
    final result = await _getShopPage(slug);
    if (isClosed) return;
    result.match(
      (failure) => emit(
        state.copyWith(
          status: ViewStatus.failure,
          notFound: failure is ServerFailure && failure.statusCode == _notFoundStatus,
          errorMessage: failure.message,
        ),
      ),
      (page) => emit(state.copyWith(status: ViewStatus.success, page: page)),
    );
  }
}
