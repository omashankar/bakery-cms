import 'package:equatable/equatable.dart';

/// A titled paragraph the shop wrote for the product ("Product Details",
/// "Care Instructions").
class DescriptionBlock extends Equatable {
  const DescriptionBlock({required this.id, required this.heading, required this.body});

  final String id;
  final String heading;
  final String body;

  @override
  List<Object?> get props => [id, heading, body];
}
