import 'dart:math' as math;

import '../entities/frame_box.dart';
import '../entities/name_placement.dart';
import '../entities/photo_placement.dart';
import '../entities/photo_print_draft.dart';
import '../entities/photo_print_range.dart';

/// The arithmetic of a photo print, ported from the website's
/// `lib/images/photo-print-layout.ts` so the app sends the shop the same
/// file for the same slider positions. Everything is a fraction of the
/// frame, so one set of numbers fills the preview and the 2400px print.
abstract final class PhotoPrintLayout {
  /// The printed file's LONG side, in pixels (`OUTPUT_PX`).
  static const int outputPx = 2400;

  /// How many characters fit on a printed frame (`NAME_LIMIT`).
  static const int nameLimit = 25;

  /// What the phone is asked to open (`MAX_CHOSEN_BYTES`): 20 MB.
  static const int maxChosenBytes = 20 * 1024 * 1024;

  /// The JPEG quality the print is encoded at, and the harder squeeze used
  /// when that comes out over [squeezeAboveBytes] (the website's `paint`).
  static const int jpegQuality = 90;
  static const int squeezedJpegQuality = 70;
  static const int squeezeAboveBytes = 4 * 1024 * 1024;

  /// The white sheet around the outline: a JPEG has no transparency, and the
  /// part outside the outline is not printed (`GROUND`).
  static const int groundColour = 0xFFFFFFFF;

  /// The lettering colours offered, ARGB. The website takes any colour from
  /// a colour input; a phone gets the starting brown plus the inks a cake
  /// shop prints with. These are print data, not the app's theme.
  static const List<int> nameColours = [
    0xFF8B4513, // the website's starting colour
    0xFF000000,
    0xFFFFFFFF,
    0xFFC62828,
    0xFFD81B60,
    0xFFB8860B,
    0xFF1565C0,
    0xFF2E7D32,
  ];

  /// `PHOTO_RANGES`.
  static const PhotoPrintRange zoomRange = PhotoPrintRange(min: 1, max: 3, step: 0.01);
  static const PhotoPrintRange offsetRange = PhotoPrintRange(min: -1, max: 1, step: 0.01);
  static const PhotoPrintRange rotationRange = PhotoPrintRange(min: -180, max: 180, step: 1);
  static const PhotoPrintRange nameSizeRange = PhotoPrintRange(min: 0.04, max: 0.2, step: 0.005);

  /// The notch between the heart's lobes, where its outline starts and ends.
  static const double heartNotch = 0.1175;

  /// The heart as six cubic curves in fractions of its box, mirrored down the
  /// middle, from the notch: `[c1x, c1y, c2x, c2y, x, y]` per curve. The
  /// website's `HEART`, unchanged.
  static const List<List<double>> heartCurves = [
    [0.4754, 0.08, 0.3901, 0, 0.2923, 0],
    [0, 0, 0, 0.3343, 0, 0.3169],
    [0, 0.6643, 0.28, 0.8088, 0.5, 1],
    [0.72, 0.8088, 1, 0.6643, 1, 0.3169],
    [1, 0.3343, 1, 0, 0.7077, 0],
    [0.6099, 0, 0.5246, 0.08, 0.5, heartNotch],
  ];

  /// How many more characters the frame takes. Never negative.
  static int charactersLeft(String name) => math.max(0, nameLimit - name.length);

  /// Cover, not contain: at zoom 1 the photo spans the frame both ways and
  /// overhangs in one; then the customer's zoom, nudge and turn
  /// (`photoPlacement`).
  static PhotoPlacement photoPlacement({
    required int imageWidth,
    required int imageHeight,
    required FrameBox frame,
    required PhotoPrintDraft draft,
  }) {
    final fits = imageWidth > 0 && imageHeight > 0
        ? math.max(frame.width / imageWidth, frame.height / imageHeight)
        : 0.0;
    final scale = fits * draft.zoom;
    return PhotoPlacement(
      centreX: frame.width / 2 + draft.offsetX * frame.width * 0.5,
      centreY: frame.height / 2 + draft.offsetY * frame.height * 0.5,
      width: imageWidth * scale,
      height: imageHeight * scale,
      radians: draft.rotation * math.pi / 180,
    );
  }

  /// The lettering, sized against the SHORT side, so a wide frame does not
  /// make it taller (`namePlacement`).
  static NamePlacement namePlacement({required FrameBox frame, required PhotoPrintDraft draft}) {
    return NamePlacement(
      x: frame.width / 2 + draft.nameX * frame.width * 0.5,
      y: frame.height / 2 + draft.nameY * frame.height * 0.5,
      radians: draft.nameRotation * math.pi / 180,
      fontSize: draft.nameSize * frame.shortSide,
      bold: draft.bold,
      italic: draft.italic,
    );
  }

  /// The website's size refusal (`photoFileProblem`), before anything is
  /// decoded. The shop sniffs the bytes of what is uploaded either way.
  static bool isTooLarge(int bytes) => bytes > maxChosenBytes;
}
