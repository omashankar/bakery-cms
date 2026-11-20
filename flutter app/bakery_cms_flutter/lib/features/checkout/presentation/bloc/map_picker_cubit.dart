import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/geo_point.dart';
import '../../domain/usecases/get_current_location.dart';
import '../../domain/usecases/get_current_location_params.dart';
import 'map_picker_state.dart';

/// The pin on the map picker. Simple state, so a Cubit.
class MapPickerCubit extends Cubit<MapPickerState> {
  MapPickerCubit(this._getCurrentLocation, {GeoPoint? initial})
    : super(MapPickerState(center: initial ?? defaultCenter));

  final GetCurrentLocation _getCurrentLocation;

  /// Where the shop is (Kota), when nothing better is known.
  static const GeoPoint defaultCenter = GeoPoint(lat: 25.2138, lng: 75.8648);

  /// On opening the map: centres on the customer only if they allowed
  /// location before. Never prompts, and says nothing when it cannot: the
  /// customer did not ask for anything.
  Future<void> locateIfAllowed() async {
    final start = state.center;
    final result = await _getCurrentLocation(const GetCurrentLocationParams(askPermission: false));
    // Not over a pin the customer has already moved, nor a lookup they started.
    if (isClosed || state.center != start || state.locateStatus.isLoading) return;
    result.match(
      (_) {},
      (point) => emit(state.copyWith(center: point, recenterId: state.recenterId + 1)),
    );
  }

  /// The customer moved the map or tapped a point.
  void moved(GeoPoint center) => emit(state.copyWith(center: center));

  /// "Use my current location": asks for permission if it has to.
  Future<void> locate() async {
    if (state.locateStatus.isLoading) return;
    emit(state.copyWith(locateStatus: ViewStatus.loading));
    final result = await _getCurrentLocation(const GetCurrentLocationParams(askPermission: true));
    // The customer may have left the map while the phone looked them up.
    if (isClosed) return;
    result.match(
      (failure) =>
          emit(state.copyWith(locateStatus: ViewStatus.failure, errorMessage: failure.message)),
      (point) => emit(
        state.copyWith(
          center: point,
          locateStatus: ViewStatus.success,
          recenterId: state.recenterId + 1,
        ),
      ),
    );
  }
}
