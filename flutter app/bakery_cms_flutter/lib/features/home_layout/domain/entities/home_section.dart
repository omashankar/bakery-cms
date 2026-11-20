import 'package:equatable/equatable.dart';

import 'home_link.dart';
import 'section_tone.dart';

/// One band of the home page, as the shop published it in the Homepage
/// Builder. The subclasses say what the band holds.
abstract class HomeSection extends Equatable {
  const HomeSection({
    required this.id,
    this.tone = SectionTone.plain,
    this.overline,
    this.title,
    this.description,
    this.cta,
  });

  final String id;
  final SectionTone tone;

  /// The small line above the title.
  final String? overline;
  final String? title;
  final String? description;

  /// "View all" and its kin.
  final HomeLink? cta;

  List<Object?> get sectionProps => [id, tone, overline, title, description, cta];
}
