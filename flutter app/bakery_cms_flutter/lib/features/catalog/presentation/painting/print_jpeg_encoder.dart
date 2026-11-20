import 'dart:typed_data';

import 'package:image/image.dart' as img;

import '../../domain/services/photo_print_layout.dart';

/// A flattened print's pixels, RGBA, row by row.
class PrintPixels {
  const PrintPixels({required this.width, required this.height, required this.rgba});

  final int width;
  final int height;
  final Uint8List rgba;
}

/// Encodes [pixels] as the JPEG the shop receives: quality 90, and a harder
/// squeeze to 70 when that came out over 4 MB (the website's `paint`, which
/// keeps a noisy photo under the upload's 6 MB cap).
///
/// Top level and pure, so it can run on another isolate with `compute`.
Uint8List encodePrintJpeg(PrintPixels pixels) {
  final image = img.Image.fromBytes(
    width: pixels.width,
    height: pixels.height,
    bytes: pixels.rgba.buffer,
    bytesOffset: pixels.rgba.offsetInBytes,
    numChannels: 4,
    order: img.ChannelOrder.rgba,
  );
  final first = img.encodeJpg(image, quality: PhotoPrintLayout.jpegQuality);
  if (first.length <= PhotoPrintLayout.squeezeAboveBytes) return first;
  return img.encodeJpg(image, quality: PhotoPrintLayout.squeezedJpegQuality);
}
