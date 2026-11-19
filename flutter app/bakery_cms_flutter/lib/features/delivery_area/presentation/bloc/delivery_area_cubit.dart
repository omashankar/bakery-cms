import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/no_params.dart';
import '../../domain/entities/delivery_area.dart';
import '../../domain/usecases/check_delivery_area.dart';
import '../../domain/usecases/load_delivery_area.dart';
import '../../domain/usecases/save_delivery_area.dart';
import 'delivery_area_state.dart';
import 'delivery_area_status.dart';

/// The customer's delivery PIN code, app-wide (provided in `App`).
///
/// - [load]: the area kept on this device. No request, so the home page
///   shows it on first paint.
/// - [save]: the area the customer chose in `PincodeSheet` (already checked
///   there), kept for the next launch.
/// - [refresh]: asks the shop about the chosen PIN code again and keeps the
///   new answer; [retry] repeats a refresh that failed.
///
/// Nothing here runs a request on its own: a screen that wants a fresh
/// answer calls [refresh].
class DeliveryAreaCubit extends Cubit<DeliveryAreaState> {
  DeliveryAreaCubit({
    required LoadDeliveryArea loadDeliveryArea,
    required SaveDeliveryArea saveDeliveryArea,
    required CheckDeliveryArea checkDeliveryArea,
  }) : _load = loadDeliveryArea,
       _save = saveDeliveryArea,
       _check = checkDeliveryArea,
       super(const DeliveryAreaState());

  final LoadDeliveryArea _load;
  final SaveDeliveryArea _save;
  final CheckDeliveryArea _check;

  /// Reads the kept area. What cannot be read counts as none chosen.
  Future<void> load() async {
    final area = (await _load(const NoParams())).getRight().toNullable();
    // A choice made while the device was being read is newer than it.
    if (isClosed || state.area != null) return;
    emit(DeliveryAreaState(status: DeliveryAreaStatus.of(area), area: area));
  }

  /// Makes [area] the chosen one, shown at once. It stays chosen for this
  /// visit even if the device cannot keep it.
  Future<void> save(DeliveryArea area) async {
    emit(DeliveryAreaState(status: DeliveryAreaStatus.of(area), area: area));
    await _save(area);
  }

  /// Asks the shop about the chosen PIN code again. Nothing to do when none
  /// is chosen.
  Future<void> refresh() async {
    final pincode = state.pincode;
    if (pincode == null || state.status == DeliveryAreaStatus.checking) return;
    emit(DeliveryAreaState(status: DeliveryAreaStatus.checking, area: state.area));
    final result = await _check(pincode);
    if (isClosed) return;
    await result.match(
      (failure) async => emit(
        DeliveryAreaState(
          status: DeliveryAreaStatus.failure,
          area: state.area,
          errorMessage: failure.message,
        ),
      ),
      save,
    );
  }

  /// Repeats the refresh that failed.
  Future<void> retry() => refresh();
}
