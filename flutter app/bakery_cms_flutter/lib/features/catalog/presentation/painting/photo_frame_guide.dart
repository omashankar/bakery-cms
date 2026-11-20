import 'package:flutter/painting.dart';

/// The preview's cut line: its colour, and the tint that shows the shape
/// before a photo is chosen.
class PhotoFrameGuide {
  const PhotoFrameGuide({required this.line, required this.fill});

  final Color line;
  final Color fill;
}
