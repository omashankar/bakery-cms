import 'package:equatable/equatable.dart';

/// The products saved on this phone, newest first.
class WishlistState extends Equatable {
  const WishlistState({this.slugs = const []});

  final List<String> slugs;

  bool contains(String slug) => slugs.contains(slug);

  @override
  List<Object?> get props => [slugs];
}
