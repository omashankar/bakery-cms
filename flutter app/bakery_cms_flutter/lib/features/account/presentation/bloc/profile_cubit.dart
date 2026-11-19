import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/usecases/update_profile.dart';
import '../../domain/usecases/update_profile_params.dart';
import 'profile_state.dart';

class ProfileCubit extends Cubit<ProfileState> {
  ProfileCubit(this._updateProfile) : super(const ProfileState());

  final UpdateProfile _updateProfile;

  Future<void> save({required String name, String? phone}) async {
    if (state.status.isLoading) return;
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _updateProfile(UpdateProfileParams(name: name, phone: phone));
    if (isClosed) return; // the screen was left mid-request
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (_) => emit(state.copyWith(status: ViewStatus.success)),
    );
  }

  /// Back to idle when the edit sheet is opened again.
  void reset() => emit(const ProfileState());
}
