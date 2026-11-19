import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_durations.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/utils/view_status.dart';
import '../../domain/usecases/find_pincode_place.dart';
import 'pincode_place_event.dart';
import 'pincode_place_state.dart';

/// Looks up where the PIN in an address form is, once typing pauses on six
/// valid digits, as the website's address forms ask `GET /api/pincodes`.
///
/// A newer PIN cancels the wait and the answer for the older one, so a slow
/// answer never lands on a box that has moved on. The same PIN reported
/// twice in a row (a cursor move) is one lookup, not a restart. Never blocks the form: the
/// form decides what, if anything, to fill in from [PincodePlaceState.place].
class PincodePlaceBloc extends Bloc<PincodePlaceTyped, PincodePlaceState> {
  PincodePlaceBloc(this._find, {Duration pause = AppDurations.pincodeLookup})
    : _pause = pause,
      super(const PincodePlaceState()) {
    on<PincodePlaceTyped>(
      _onTyped,
      transformer: (events, mapper) => restartable<PincodePlaceTyped>()(events.distinct(), mapper),
    );
  }

  final FindPincodePlace _find;
  final Duration _pause;

  Future<void> _onTyped(PincodePlaceTyped event, Emitter<PincodePlaceState> emit) async {
    final code = event.pincode.trim();
    if (Validators.pincode(code) != null) {
      // Still typing (or cleared): nothing to look up, nothing to fill.
      emit(PincodePlaceState(pincode: code));
      return;
    }
    emit(PincodePlaceState(status: ViewStatus.loading, pincode: code));
    await Future<void>.delayed(_pause);
    if (emit.isDone) return;
    final result = await _find(code);
    if (emit.isDone) return;
    emit(
      result.match(
        (_) => PincodePlaceState(status: ViewStatus.failure, pincode: code),
        (place) => PincodePlaceState(status: ViewStatus.success, pincode: code, place: place),
      ),
    );
  }
}
