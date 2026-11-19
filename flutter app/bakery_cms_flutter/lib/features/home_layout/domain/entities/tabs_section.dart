import 'home_section.dart';
import 'home_tab.dart';

/// One heading, several tabs, one row of products under the chosen tab.
class TabsSection extends HomeSection {
  const TabsSection({
    required super.id,
    required this.tabs,
    super.tone,
    super.overline,
    super.title,
    super.description,
    super.cta,
  });

  final List<HomeTab> tabs;

  @override
  List<Object?> get props => [...sectionProps, tabs];
}
