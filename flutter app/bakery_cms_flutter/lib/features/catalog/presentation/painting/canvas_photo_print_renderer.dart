import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../../domain/entities/photo_frame_shape.dart';
import '../../domain/entities/photo_print_draft.dart';
import '../../domain/services/photo_print_renderer.dart';
import 'photo_frame_painting.dart';
import 'print_jpeg_encoder.dart';

/// [PhotoPrintRenderer] on the phone's own canvas: decode the photo, paint
/// the print at 2400px with [PhotoFramePainting], encode it on another
/// isolate, and save it to the temporary folder for the upload.
class CanvasPhotoPrintRenderer implements PhotoPrintRenderer {
  CanvasPhotoPrintRenderer({Future<Directory> Function()? directory})
    : _directory = directory ?? getTemporaryDirectory;

  final Future<Directory> Function() _directory;

  static const String _filePrefix = 'photo-print-';
  static const String _fileExtension = '.jpg';

  @override
  Future<String> render({
    required String sourcePath,
    required PhotoFrameShape shape,
    required PhotoPrintDraft draft,
  }) async {
    final bytes = await File(sourcePath).readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final photo = (await codec.getNextFrame()).image;
    codec.dispose();

    final box = PhotoFramePainting.printBox(shape);
    final recorder = ui.PictureRecorder();
    PhotoFramePainting.paint(ui.Canvas(recorder), shape: shape, image: photo, draft: draft);
    final picture = recorder.endRecording();
    final flat = await picture.toImage(box.width, box.height);
    picture.dispose();
    photo.dispose();

    final data = await flat.toByteData(format: ui.ImageByteFormat.rawRgba);
    flat.dispose();
    if (data == null) throw StateError('The print could not be read back.');

    final jpeg = await compute(
      encodePrintJpeg,
      PrintPixels(width: box.width, height: box.height, rgba: data.buffer.asUint8List()),
    );
    final folder = await _directory();
    final file = File(
      '${folder.path}${Platform.pathSeparator}$_filePrefix'
      '${DateTime.now().microsecondsSinceEpoch}$_fileExtension',
    );
    await file.writeAsBytes(jpeg, flush: true);
    return file.path;
  }
}
