import 'home_section.dart';

/// What this customer looked at last, from the phone's own history.
class RecentlyViewedSection extends HomeSection {
  const RecentlyViewedSection({
    required super.id,
    required this.maxCount,
    super.tone,
    super.overline,
    super.title,
    super.description,
    super.cta,
  });

  final int maxCount;

  @override
  List<Object?> get props => [...sectionProps, maxCount];
}
