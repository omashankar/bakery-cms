import 'dart:math' as math;

import 'package:bakery_cms_flutter/features/catalog/domain/entities/frame_box.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/photo_frame_shape.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/photo_print_draft.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/services/photo_print_layout.dart';
import 'package:flutter_test/flutter_test.dart';

/// The print maths, against the numbers the website's
/// `lib/images/photo-print-layout.ts` produces for the same input.
void main() {
  group('frame sizes (frameSize at OUTPUT_PX 2400)', () {
    test('the long side is 2400 for every shape, as the website prints it', () {
      final sizes = {
        for (final shape in PhotoFrameShape.values)
          shape: shape.frameSize(PhotoPrintLayout.outputPx),
      };
      expect(sizes[PhotoFrameShape.circle], const FrameBox(width: 2400, height: 2400));
      expect(sizes[PhotoFrameShape.square], const FrameBox(width: 2400, height: 2400));
      expect(sizes[PhotoFrameShape.heart], const FrameBox(width: 2400, height: 2400));
      expect(sizes[PhotoFrameShape.portrait], const FrameBox(width: 1800, height: 2400));
      expect(sizes[PhotoFrameShape.landscape], const FrameBox(width: 2400, height: 1800));
      // Math.round(2400 / (7/3)) = 1029.
      expect(sizes[PhotoFrameShape.wrap], const FrameBox(width: 2400, height: 1029));
    });

    test('an unknown or absent shape is round, as the website falls back', () {
      expect(PhotoFrameShape.fromId(null), PhotoFrameShape.circle);
      expect(PhotoFrameShape.fromId('star'), PhotoFrameShape.circle);
      expect(PhotoFrameShape.fromId('heart'), PhotoFrameShape.heart);
    });
  });

  group('photoPlacement', () {
    const square = FrameBox(width: 2400, height: 2400);

    test('cover: a wide photo spans the height and overhangs the sides', () {
      final placed = PhotoPrintLayout.photoPlacement(
        imageWidth: 4000,
        imageHeight: 2000,
        frame: square,
        draft: PhotoPrintDraft.empty,
      );
      expect(placed.height, 2400);
      expect(placed.width, 4800);
      expect(placed.centreX, 1200);
      expect(placed.centreY, 1200);
      expect(placed.radians, 0);
    });

    test('zoom scales, offsets move by half the frame, rotation is degrees', () {
      final placed = PhotoPrintLayout.photoPlacement(
        imageWidth: 1000,
        imageHeight: 1000,
        frame: const FrameBox(width: 1800, height: 2400),
        draft: const PhotoPrintDraft(zoom: 2, offsetX: 0.5, offsetY: -1, rotation: 90),
      );
      // fits = max(1800/1000, 2400/1000) = 2.4; × zoom 2.
      expect(placed.width, 4800);
      expect(placed.height, 4800);
      expect(placed.centreX, 900 + 0.5 * 1800 * 0.5);
      expect(placed.centreY, 1200 - 2400 * 0.5);
      expect(placed.radians, closeTo(math.pi / 2, 1e-9));
    });

    test('a photo with no size is not drawn', () {
      final placed = PhotoPrintLayout.photoPlacement(
        imageWidth: 0,
        imageHeight: 0,
        frame: square,
        draft: PhotoPrintDraft.empty,
      );
      expect(placed.width, 0);
    });
  });

  group('namePlacement', () {
    test('sized against the SHORT side, and placed in the lower third to start', () {
      final placed = PhotoPrintLayout.namePlacement(
        frame: const FrameBox(width: 2400, height: 1029),
        draft: PhotoPrintDraft.empty,
      );
      expect(placed.fontSize, closeTo(0.11 * 1029, 1e-9));
      expect(placed.x, 1200);
      expect(placed.y, closeTo(1029 / 2 + 0.35 * 1029 * 0.5, 1e-9));
      expect(placed.bold, isTrue);
      expect(placed.italic, isFalse);
    });
  });

  group('the name and the draft', () {
    test('25 characters, never fewer than none left', () {
      expect(PhotoPrintLayout.charactersLeft(''), 25);
      expect(PhotoPrintLayout.charactersLeft('Riya'), 21);
      expect(PhotoPrintLayout.charactersLeft('x' * 30), 0);
    });

    test('the starting draft is the website\'s emptyPhotoPrintDraft', () {
      const empty = PhotoPrintDraft.empty;
      expect(
        [empty.zoom, empty.offsetX, empty.offsetY, empty.rotation, empty.nameSize, empty.nameY],
        [1, 0, 0, 0, 0.11, 0.35],
      );
      expect(empty.colour, 0xFF8B4513);
      expect(empty.bold, isTrue);
    });

    test('a new photo starts square on and keeps the name; start again keeps only the name', () {
      const fitted = PhotoPrintDraft(
        zoom: 2,
        offsetX: 0.3,
        rotation: 20,
        name: 'Riya',
        italic: true,
        nameY: -0.2,
      );
      final fresh = fitted.forNewPhoto();
      expect([fresh.zoom, fresh.offsetX, fresh.rotation], [1, 0, 0]);
      expect(fresh.name, 'Riya');
      expect(fresh.italic, isTrue);
      expect(fresh.nameY, -0.2);

      expect(fitted.startAgain(), const PhotoPrintDraft(name: 'Riya'));
    });

    test('the slider ranges are the website\'s PHOTO_RANGES', () {
      expect(PhotoPrintLayout.zoomRange.min, 1);
      expect(PhotoPrintLayout.zoomRange.max, 3);
      expect(PhotoPrintLayout.offsetRange.min, -1);
      expect(PhotoPrintLayout.rotationRange.max, 180);
      expect(PhotoPrintLayout.nameSizeRange.min, 0.04);
      expect(PhotoPrintLayout.nameSizeRange.max, 0.2);
      expect(PhotoPrintLayout.zoomRange.clamp(9), 3);
    });

    test('a file over 20 MB is refused before it is opened', () {
      expect(PhotoPrintLayout.isTooLarge(20 * 1024 * 1024), isFalse);
      expect(PhotoPrintLayout.isTooLarge(20 * 1024 * 1024 + 1), isTrue);
    });
  });

  test('the heart is mirrored down the middle, as the website\'s HEART is', () {
    const curves = PhotoPrintLayout.heartCurves;
    // Curve 1 mirrors 6, 2 mirrors 5, 3 mirrors 4: each the other read
    // backwards with x flipped.
    List<List<double>> points(List<double> c) => [
      [c[0], c[1]],
      [c[2], c[3]],
      [c[4], c[5]],
    ];
    for (final (a, b) in [(0, 5), (1, 4), (2, 3)]) {
      final left = points(curves[a]);
      final right = points(curves[b]);
      final start = a == 0 ? [0.5, PhotoPrintLayout.heartNotch] : points(curves[a - 1])[2];
      // The mirror of a's controls, read backwards, are b's controls.
      expect(1 - left[1][0], closeTo(right[0][0], 1e-9));
      expect(left[1][1], closeTo(right[0][1], 1e-9));
      expect(1 - left[0][0], closeTo(right[1][0], 1e-9));
      expect(left[0][1], closeTo(right[1][1], 1e-9));
      expect(1 - start[0], closeTo(right[2][0], 1e-9));
      expect(start[1], closeTo(right[2][1], 1e-9));
    }
  });
}
