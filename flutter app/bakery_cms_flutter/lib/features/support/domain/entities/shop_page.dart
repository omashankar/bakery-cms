import 'package:equatable/equatable.dart';

import 'page_block.dart';

/// A published CMS page (Privacy Policy, Terms of Service, …), as
/// /store/pages/[slug] draws it: a title and its blocks.
class ShopPage extends Equatable {
  const ShopPage({
    required this.slug,
    required this.title,
    this.description = '',
    this.blocks = const [],
  });

  /// The slugs the website serves at /store/privacy and /store/terms.
  static const String privacySlug = 'privacy';
  static const String termsSlug = 'terms';

  final String slug;
  final String title;
  final String description;
  final List<PageBlock> blocks;

  @override
  List<Object?> get props => [slug, title, description, blocks];
}
