import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/constants/strings/catalog_strings.dart';
import '../../../../../core/utils/view_status.dart';
import '../../../../media/domain/photo_picker.dart';
import '../../../../media/domain/photo_source.dart';
import '../../../domain/entities/photo_frame_shape.dart';
import '../../../domain/entities/photo_print_draft.dart';
import '../../../domain/services/photo_print_renderer.dart';
import '../../../domain/usecases/upload_cake_photo.dart';
import 'cake_photo_state.dart';

/// The photo for a photo cake, as the website handles it
/// (`photo-print-editor.tsx`): pick a photo, fit it (and a name) into the
/// product's print shape in the editor, then send the shop the ONE flattened
/// JPEG the editor paints — never the original file.
class CakePhotoCubit extends Cubit<CakePhotoState> {
  CakePhotoCubit(this._picker, this._uploadCakePhoto, this._renderer)
    : super(const CakePhotoState());

  final PhotoPicker _picker;
  final UploadCakePhoto _uploadCakePhoto;
  final PhotoPrintRenderer _renderer;

  /// Choose a photo, then open the editor on it. A new photo starts square
  /// on; the name is kept. Backing out of the picker changes nothing.
  Future<void> pick(PhotoSource source) async {
    if (state.status.isLoading) return;
    if (state.errorMessage != null && !state.status.isFailure) {
      emit(state.copyWith()); // clear the last notice, so the next one shows
    }
    final String? path;
    try {
      path = await _picker.pick(source);
    } catch (error) {
      debugPrint('Photo picker failed: $error');
      if (!isClosed) emit(state.copyWith(errorMessage: CatalogStrings.photoPickFailed));
      return;
    }
    if (path == null || isClosed) return;
    emit(state.copyWith(sourcePath: path, draft: state.draft.forNewPhoto(), editing: true));
  }

  /// Reopen the editor on the photo already chosen, as it was left.
  void edit() {
    if (state.sourcePath == null || state.status.isLoading) return;
    emit(state.copyWith(editing: true));
  }

  /// The editor closed without "Use this photo". A photo already attached
  /// stays attached; a photo that was only picked is let go.
  void closeEditor() {
    if (!state.editing) return;
    if (state.hasPhoto) {
      emit(state.copyWith(editing: false));
    } else {
      emit(CakePhotoState(draft: state.draft));
    }
  }

  /// "Use this photo": paint the print in [shape] from [draft], then upload
  /// that file through the same endpoint and field the website uses.
  Future<void> use(PhotoPrintDraft draft, PhotoFrameShape shape) async {
    final source = state.sourcePath;
    if (source == null || state.status.isLoading) return;
    emit(
      CakePhotoState(
        status: ViewStatus.loading,
        localPath: state.localPath,
        sourcePath: source,
        draft: draft,
      ),
    );
    final String printPath;
    try {
      printPath = await _renderer.render(sourcePath: source, shape: shape, draft: draft);
    } catch (error) {
      debugPrint('Photo print failed: $error');
      if (isClosed || !_stillPrinting(source)) return;
      emit(
        CakePhotoState(
          sourcePath: source,
          draft: draft,
          errorMessage: CatalogStrings.photoPrintFailed,
        ),
      );
      return;
    }
    if (isClosed || !_stillPrinting(source)) return;
    await _upload(printPath);
  }

  /// Send the same print again after a failed upload.
  Future<void> retry() async {
    final path = state.localPath;
    if (path == null || !state.status.isFailure) return;
    await _upload(path);
  }

  void remove() => emit(const CakePhotoState());

  bool _stillPrinting(String source) => state.status.isLoading && state.sourcePath == source;

  Future<void> _upload(String path) async {
    final source = state.sourcePath;
    final draft = state.draft;
    emit(
      CakePhotoState(status: ViewStatus.loading, localPath: path, sourcePath: source, draft: draft),
    );
    final result = await _uploadCakePhoto(path);
    // Left mid-upload, or the customer removed or replaced the photo while it
    // went: this answer is for a photo nobody is looking at any more.
    if (isClosed || state.localPath != path || !state.status.isLoading) return;
    result.match(
      (failure) => emit(
        CakePhotoState(
          status: ViewStatus.failure,
          localPath: path,
          errorMessage: failure.message,
          sourcePath: source,
          draft: draft,
        ),
      ),
      (url) => emit(
        CakePhotoState(
          status: ViewStatus.success,
          localPath: path,
          url: url,
          sourcePath: source,
          draft: draft,
        ),
      ),
    );
  }
}
