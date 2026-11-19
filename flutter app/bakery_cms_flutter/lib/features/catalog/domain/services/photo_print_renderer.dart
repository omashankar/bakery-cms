import '../entities/photo_frame_shape.dart';
import '../entities/photo_print_draft.dart';

/// Flattens the customer's photo and name into the one JPEG the shop prints:
/// [PhotoFrameShape.frameSize] of the print's long side, white outside the
/// outline. Returns the file's path on this phone.
///
/// Throws when the photo cannot be opened or drawn.
abstract interface class PhotoPrintRenderer {
  Future<String> render({
    required String sourcePath,
    required PhotoFrameShape shape,
    required PhotoPrintDraft draft,
  });
}
