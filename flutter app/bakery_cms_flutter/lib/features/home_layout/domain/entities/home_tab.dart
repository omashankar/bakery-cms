import 'package:equatable/equatable.dart';

/// One tab of a tabbed product row.
class HomeTab extends Equatable {
  const HomeTab({required this.label, required this.productSlugs, this.href});

  final String label;
  final List<String> productSlugs;
  final String? href;

  @override
  List<Object?> get props => [label, productSlugs, href];
}
