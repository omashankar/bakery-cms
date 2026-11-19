import 'package:get_it/get_it.dart';

import 'data/image_picker_photo_picker.dart';
import 'domain/photo_picker.dart';

/// Safe to call more than once: the catalog (photo cakes) and the account
/// (profile photo) both need the picker, and each registers what it uses.
void registerMediaFeature(GetIt sl) {
  if (sl.isRegistered<PhotoPicker>()) return;
  sl.registerLazySingleton<PhotoPicker>(ImagePickerPhotoPicker.new);
}
