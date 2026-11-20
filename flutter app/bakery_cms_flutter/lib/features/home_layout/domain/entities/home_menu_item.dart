import 'package:equatable/equatable.dart';

/// One top-level item of the shop's website header menu ("Cakes",
/// "Occasions", ...), drawn as an icon tab under the home search bar.
class HomeMenuItem extends Equatable {
  const HomeMenuItem({required this.label, required this.href, this.imageUrl = ''});

  final String label;

  /// A website path such as `/store/collections/cakes`; the app maps it.
  final String href;

  /// The linked group's picture, or "" when the menu item has none.
  final String imageUrl;

  @override
  List<Object?> get props => [label, href, imageUrl];
}
