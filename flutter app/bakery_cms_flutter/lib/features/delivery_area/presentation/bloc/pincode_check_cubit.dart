import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/usecases/check_delivery_area.dart';
import 'pincode_check_state.dart';

/// The pincode sheet's Check button: asks the shop, keeps nothing. Saving the
/// answer is `DeliveryAreaCubit.save`.
class PincodeCheckCubit extends Cubit<PincodeCheckState> {
  PincodeCheckCubit(this._check) : super(const PincodeCheckState());

  final CheckDeliveryArea _check;

  Future<void> check(String pincode) async {
    final asked = pincode.trim();
    emit(PincodeCheckState(status: ViewStatus.loading, pincode: asked));
    final result = await _check(asked);
    // The customer changed the PIN code while this one was being asked.
    if (isClosed || state.pincode != asked) return;
    emit(
      result.match(
        (failure) => PincodeCheckState(
          status: ViewStatus.failure,
          pincode: asked,
          errorMessage: failure.message,
        ),
        (answer) => PincodeCheckState(status: ViewStatus.success, pincode: asked, answer: answer),
      ),
    );
  }

  /// Asks again about the PIN code whose check failed.
  Future<void> retry() => check(state.pincode);

  /// The PIN code was edited: an earlier answer no longer applies.
  void reset() {
    if (state.status.isInitial) return;
    emit(const PincodeCheckState());
  }
}
