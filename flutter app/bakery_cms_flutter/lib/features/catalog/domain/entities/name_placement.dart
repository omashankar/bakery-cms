import 'package:equatable/equatable.dart';

/// Where the name is drawn, its turn, and what it is set in.
class NamePlacement extends Equatable {
  const NamePlacement({
    required this.x,
    required this.y,
    required this.radians,
    required this.fontSize,
    required this.bold,
    required this.italic,
  });

  final double x;
  final double y;
  final double radians;
  final double fontSize;
  final bool bold;
  final bool italic;

  @override
  List<Object?> get props => [x, y, radians, fontSize, bold, italic];
}
