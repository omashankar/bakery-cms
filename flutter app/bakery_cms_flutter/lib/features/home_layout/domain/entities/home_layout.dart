import 'package:equatable/equatable.dart';

import 'home_menu_item.dart';
import 'home_section.dart';

/// The home page the shop published, band by band, and the top-level items
/// of its website header menu.
class HomeLayout extends Equatable {
  const HomeLayout({this.sections = const [], this.menu = const [], this.updatedAt = ''});

  final List<HomeSection> sections;

  /// The header menu's top-level items, in the website's order. Empty when
  /// the shop has none (or an older server does not send them).
  final List<HomeMenuItem> menu;
  final String updatedAt;

  /// No band to draw. The menu alone does not make a page.
  bool get isEmpty => sections.isEmpty;

  @override
  List<Object?> get props => [sections, menu, updatedAt];
}
