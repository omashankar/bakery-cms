import 'dart:io';
import 'dart:ui' as ui;

/// Opens the customer's photo for the editor's preview: its size on disk
/// (refused over 20 MB before anything is decoded, as on the website) and
/// the decoded picture.
class PhotoImageDecoder {
  const PhotoImageDecoder();

  Future<int> sizeOf(String path) => File(path).length();

  Future<ui.Image> decode(String path) async {
    final codec = await ui.instantiateImageCodec(await File(path).readAsBytes());
    final frame = await codec.getNextFrame();
    codec.dispose();
    return frame.image;
  }
}
