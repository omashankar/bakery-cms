import 'package:equatable/equatable.dart';

/// A section's own button: its words and the website address it points at.
class HomeLink extends Equatable {
  const HomeLink({required this.label, required this.href});

  final String label;

  /// A website path such as `/store/collections/cakes`; the app maps it.
  final String href;

  @override
  List<Object?> get props => [label, href];
}
