import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/account_strings.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/utils/view_status.dart';
import '../../../media/domain/photo_picker.dart';
import '../../../media/domain/photo_source.dart';
import '../../domain/usecases/remove_avatar.dart';
import '../../domain/usecases/upload_avatar.dart';
import 'avatar_change.dart';
import 'avatar_state.dart';

class AvatarCubit extends Cubit<AvatarState> {
  AvatarCubit(this._picker, this._uploadAvatar, this._removeAvatar) : super(const AvatarState());

  final PhotoPicker _picker;
  final UploadAvatar _uploadAvatar;
  final RemoveAvatar _removeAvatar;

  Future<void> pick(PhotoSource source) async {
    if (state.status.isLoading) return;
    // Back to idle first, so the same refusal twice still shows twice.
    if (!state.status.isInitial) emit(const AvatarState());
    final String? path;
    try {
      path = await _picker.pick(source);
    } catch (error) {
      debugPrint('Photo picker failed: $error');
      if (!isClosed) {
        emit(const AvatarState(
          status: ViewStatus.failure,
          errorMessage: AccountStrings.photoPickFailed,
        ));
      }
      return;
    }
    if (path == null || isClosed) return; // backed out
    emit(const AvatarState(status: ViewStatus.loading));
    final result = await _uploadAvatar(path);
    if (isClosed) return;
    result.match(
      (failure) => emit(AvatarState(status: ViewStatus.failure, errorMessage: failure.message)),
      (_) => emit(const AvatarState(status: ViewStatus.success, change: AvatarChange.updated)),
    );
  }

  Future<void> remove() async {
    if (state.status.isLoading) return;
    emit(const AvatarState(status: ViewStatus.loading));
    final result = await _removeAvatar(const NoParams());
    if (isClosed) return;
    result.match(
      (failure) => emit(AvatarState(status: ViewStatus.failure, errorMessage: failure.message)),
      (_) => emit(const AvatarState(status: ViewStatus.success, change: AvatarChange.removed)),
    );
  }
}
