import 'photo_source.dart';

/// Lets the customer choose one photo from the phone.
///
/// Returns the path of a file already shrunk to a sensible upload size, or
/// null when the customer backed out. Throws when the phone refused (no
/// permission, no camera).
abstract interface class PhotoPicker {
  Future<String?> pick(PhotoSource source);
}
