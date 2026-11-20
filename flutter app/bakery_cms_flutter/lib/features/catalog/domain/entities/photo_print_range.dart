import 'package:equatable/equatable.dart';

/// One slider's ends and step (the website's `PHOTO_RANGES`).
class PhotoPrintRange extends Equatable {
  const PhotoPrintRange({required this.min, required this.max, required this.step});

  final double min;
  final double max;
  final double step;

  /// How many stops the slider has.
  int get divisions => ((max - min) / step).round();

  double clamp(double value) => value.clamp(min, max).toDouble();

  @override
  List<Object?> get props => [min, max, step];
}
