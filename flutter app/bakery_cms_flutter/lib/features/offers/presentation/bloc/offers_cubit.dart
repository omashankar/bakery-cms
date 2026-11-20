import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/no_params.dart';
import '../../../../core/utils/view_status.dart';
import '../../domain/usecases/get_live_coupons.dart';
import 'offers_state.dart';

class OffersCubit extends Cubit<OffersState> {
  OffersCubit(this._getLiveCoupons) : super(const OffersState());

  final GetLiveCoupons _getLiveCoupons;

  Future<void> load() async {
    if (state.status.isLoading) return;
    emit(OffersState(status: ViewStatus.loading, coupons: state.coupons));
    final result = await _getLiveCoupons(const NoParams());
    if (isClosed) return;
    result.match(
      (_) => emit(OffersState(status: ViewStatus.failure, coupons: state.coupons)),
      (coupons) => emit(OffersState(status: ViewStatus.success, coupons: coupons)),
    );
  }
}
