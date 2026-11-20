import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';

import '../../domain/entities/photo_frame_shape.dart';
import '../../domain/entities/photo_print_draft.dart';
import 'photo_frame_guide.dart';
import 'photo_frame_painting.dart';

/// The editor's preview: the print itself, scaled to the box, with the cut
/// line drawn on top (which the printed file never has).
class PhotoPrintPreviewPainter extends CustomPainter {
  PhotoPrintPreviewPainter({
    required this.shape,
    required this.image,
    required this.draft,
    required this.guide,
  });

  final PhotoFrameShape shape;
  final ui.Image? image;
  final PhotoPrintDraft draft;
  final PhotoFrameGuide guide;

  @override
  void paint(Canvas canvas, Size size) {
    final box = PhotoFramePainting.printBox(shape);
    canvas
      ..save()
      ..scale(size.width / box.width, size.height / box.height);
    PhotoFramePainting.paint(canvas, shape: shape, image: image, draft: draft, guide: guide);
    canvas.restore();
  }

  @override
  bool shouldRepaint(PhotoPrintPreviewPainter oldDelegate) =>
      oldDelegate.shape != shape ||
      oldDelegate.image != image ||
      oldDelegate.draft != draft ||
      oldDelegate.guide.line != guide.line ||
      oldDelegate.guide.fill != guide.fill;
}
