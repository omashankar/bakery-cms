import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/constants/strings/catalog_strings.dart';
import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/photo_print_draft.dart';
import '../../../domain/services/photo_print_layout.dart';
import '../../painting/photo_image_decoder.dart';
import 'photo_print_editor_state.dart';

/// The photo print editor: opens the customer's photo once, then holds where
/// they have put it and their name while they fit it into the frame.
class PhotoPrintEditorCubit extends Cubit<PhotoPrintEditorState> {
  PhotoPrintEditorCubit({
    required String sourcePath,
    required PhotoPrintDraft draft,
    PhotoImageDecoder decoder = const PhotoImageDecoder(),
  }) : _sourcePath = sourcePath,
       _decoder = decoder,
       super(PhotoPrintEditorState(draft: draft));

  final String _sourcePath;
  final PhotoImageDecoder _decoder;

  /// Refuses a file too big to open before decoding it, as the website does,
  /// then decodes it.
  Future<void> open() async {
    emit(state.copyWith(status: ViewStatus.loading));
    try {
      if (PhotoPrintLayout.isTooLarge(await _decoder.sizeOf(_sourcePath))) {
        if (!isClosed) {
          emit(
            state.copyWith(status: ViewStatus.failure, errorMessage: CatalogStrings.printTooLarge),
          );
        }
        return;
      }
      final image = await _decoder.decode(_sourcePath);
      if (isClosed) {
        image.dispose();
        return;
      }
      emit(state.copyWith(status: ViewStatus.success, image: image));
    } catch (error) {
      debugPrint('The photo would not open: $error');
      if (!isClosed) {
        emit(
          state.copyWith(status: ViewStatus.failure, errorMessage: CatalogStrings.printOpenFailed),
        );
      }
    }
  }

  void update(PhotoPrintDraft draft) => emit(state.copyWith(draft: draft));

  /// Every slider back to the start; the name stays.
  void startAgain() => emit(state.copyWith(draft: state.draft.startAgain()));

  void showNamePanel(bool name) => emit(state.copyWith(namePanel: name));

  @override
  Future<void> close() {
    state.image?.dispose();
    return super.close();
  }
}
