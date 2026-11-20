import 'frame_box.dart';

/// The outline a photo is printed inside, as the shop set it per product.
///
/// The website's `PHOTO_FRAME_SHAPES` (`lib/images/photo-print-layout.ts`):
/// the same ids, the same proportions. Geometry, so a shop picks one and
/// cannot invent one.
enum PhotoFrameShape {
  circle('circle', 1),
  square('square', 1),
  heart('heart', 1),

  /// 3:4, an upright frame.
  portrait('portrait', 3 / 4),

  /// 4:3, the same frame laid down.
  landscape('landscape', 4 / 3),

  /// 7:3, the band round a mug.
  wrap('wrap', 7 / 3);

  const PhotoFrameShape(this.id, this.ratio);

  final String id;

  /// Width over height: the print's proportions.
  final double ratio;

  /// The shape stored against a product, falling back to round, as the
  /// website's `frameShape` does for an absent or unknown value.
  static PhotoFrameShape fromId(String? id) {
    for (final shape in values) {
      if (shape.id == id) return shape;
    }
    return circle;
  }

  /// The shape fitted into a box whose LONG side is [longSide]
  /// (`frameSize`): an upright and a wide print carry the same detail.
  FrameBox frameSize(int longSide) => ratio >= 1
      ? FrameBox(width: longSide, height: (longSide / ratio).round())
      : FrameBox(width: (longSide * ratio).round(), height: longSide);
}
