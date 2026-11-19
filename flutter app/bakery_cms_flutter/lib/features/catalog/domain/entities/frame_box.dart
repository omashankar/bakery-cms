import 'package:equatable/equatable.dart';

/// A print's size in pixels.
class FrameBox extends Equatable {
  const FrameBox({required this.width, required this.height});

  final int width;
  final int height;

  int get shortSide => width < height ? width : height;

  @override
  List<Object?> get props => [width, height];
}
