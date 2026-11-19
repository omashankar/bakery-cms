import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';

import '../../domain/entities/frame_box.dart';
import '../../domain/entities/photo_frame_shape.dart';
import '../../domain/entities/photo_print_draft.dart';
import '../../domain/services/photo_print_layout.dart';
import 'photo_frame_guide.dart';

/// Draws one photo print: the white sheet, the photo clipped to the outline,
/// then the name. The website's `paintPhotoFrame`, called by the export at
/// the print's own size and by the preview scaled down, so the preview is
/// the printed file drawn smaller rather than a likeness of it.
abstract final class PhotoFramePainting {
  /// The serif family the website asks the canvas for (Georgia, Times New
  /// Roman, serif): a system face, never a webfont still loading.
  static const String nameFontFamily = 'serif';

  /// The print's own size for [shape]: 2400 on the long side.
  static FrameBox printBox(PhotoFrameShape shape) => shape.frameSize(PhotoPrintLayout.outputPx);

  /// The printable outline of [shape] in a [size] box.
  static Path outline(PhotoFrameShape shape, Size size) {
    final width = size.width;
    final height = size.height;
    switch (shape) {
      case PhotoFrameShape.circle:
        return Path()..addOval(
          Rect.fromCircle(
            center: Offset(width / 2, height / 2),
            radius: math.min(width, height) / 2,
          ),
        );
      case PhotoFrameShape.heart:
        final path = Path()..moveTo(width / 2, height * PhotoPrintLayout.heartNotch);
        for (final c in PhotoPrintLayout.heartCurves) {
          path.cubicTo(
            c[0] * width,
            c[1] * height,
            c[2] * width,
            c[3] * height,
            c[4] * width,
            c[5] * height,
          );
        }
        return path..close();
      case PhotoFrameShape.square:
      case PhotoFrameShape.portrait:
      case PhotoFrameShape.landscape:
      case PhotoFrameShape.wrap:
        return Path()..addRect(Offset.zero & size);
    }
  }

  /// Paints the print at its own size ([printBox]) onto [canvas]. Scale the
  /// canvas first to draw it smaller.
  ///
  /// [guide] draws the cut line for the preview only (a cut line printed on a
  /// cake is a mistake): filled while there is no photo, outlined once there
  /// is, as on the website.
  static void paint(
    Canvas canvas, {
    required PhotoFrameShape shape,
    required ui.Image? image,
    required PhotoPrintDraft draft,
    PhotoFrameGuide? guide,
  }) {
    final box = printBox(shape);
    final size = Size(box.width.toDouble(), box.height.toDouble());
    final shapePath = outline(shape, size);

    canvas
      ..save()
      ..drawRect(Offset.zero & size, Paint()..color = const Color(PhotoPrintLayout.groundColour))
      ..clipPath(shapePath);

    if (image != null && image.width > 0 && image.height > 0) {
      final placed = PhotoPrintLayout.photoPlacement(
        imageWidth: image.width,
        imageHeight: image.height,
        frame: box,
        draft: draft,
      );
      canvas
        ..save()
        ..translate(placed.centreX, placed.centreY)
        ..rotate(placed.radians)
        ..drawImageRect(
          image,
          Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble()),
          Rect.fromCenter(center: Offset.zero, width: placed.width, height: placed.height),
          Paint()..filterQuality = FilterQuality.high,
        )
        ..restore();
    }

    final name = draft.name.trim();
    if (name.isNotEmpty) {
      final placed = PhotoPrintLayout.namePlacement(frame: box, draft: draft);
      final lettering = TextPainter(
        text: TextSpan(
          text: name,
          style: TextStyle(
            fontFamily: nameFontFamily,
            fontSize: placed.fontSize,
            fontWeight: placed.bold ? FontWeight.w700 : FontWeight.w400,
            fontStyle: placed.italic ? FontStyle.italic : FontStyle.normal,
            color: Color(draft.colour),
          ),
        ),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
      )..layout();
      canvas
        ..save()
        ..translate(placed.x, placed.y)
        ..rotate(placed.radians);
      // Centred both ways on the point, as `textAlign/textBaseline` do there.
      lettering.paint(canvas, Offset(-lettering.width / 2, -lettering.height / 2));
      canvas.restore();
      lettering.dispose();
    }

    canvas.restore();

    if (guide != null) {
      if (image == null) canvas.drawPath(shapePath, Paint()..color = guide.fill);
      canvas.drawPath(
        shapePath,
        Paint()
          ..style = PaintingStyle.stroke
          ..color = guide.line
          ..strokeWidth = math.max(1, math.min(size.width, size.height) / 256),
      );
    }
  }
}
