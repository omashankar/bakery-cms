import 'package:image_picker/image_picker.dart';

import '../domain/photo_picker.dart';
import '../domain/photo_source.dart';

/// [PhotoPicker] over the platform's own gallery and camera.
///
/// A phone photo is often 4000px and 5–10 MB; the shop takes 6 MB at most
/// and prints a cake, so it is scaled to [maxDimension] and re-encoded at
/// [quality] before it ever leaves the phone.
class ImagePickerPhotoPicker implements PhotoPicker {
  ImagePickerPhotoPicker([ImagePicker? picker]) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  static const double maxDimension = 2000;
  static const int quality = 85;

  @override
  Future<String?> pick(PhotoSource source) async {
    final file = await _picker.pickImage(
      source: switch (source) {
        PhotoSource.gallery => ImageSource.gallery,
        PhotoSource.camera => ImageSource.camera,
      },
      maxWidth: maxDimension,
      maxHeight: maxDimension,
      imageQuality: quality,
      requestFullMetadata: false,
    );
    return file?.path;
  }
}
