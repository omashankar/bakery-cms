import 'package:equatable/equatable.dart';

/// Where the photo lands in the frame, in frame pixels: its middle, its
/// drawn size, and its turn.
class PhotoPlacement extends Equatable {
  const PhotoPlacement({
    required this.centreX,
    required this.centreY,
    required this.width,
    required this.height,
    required this.radians,
  });

  final double centreX;
  final double centreY;
  final double width;
  final double height;
  final double radians;

  @override
  List<Object?> get props => [centreX, centreY, width, height, radians];
}
