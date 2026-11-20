import 'home_section.dart';

/// "Order in the next 2h 14m for delivery today".
class CountdownSection extends HomeSection {
  const CountdownSection({
    required super.id,
    required this.headline,
    required this.cutoffTime,
    required this.timezone,
    super.tone,
    super.overline,
    super.title,
    super.description,
    super.cta,
  });

  final String headline;

  /// The shop's same-day cut-off, `HH:mm` on its own clock.
  final String cutoffTime;

  /// IANA zone of that clock, e.g. `Asia/Kolkata`.
  final String timezone;

  @override
  List<Object?> get props => [...sectionProps, headline, cutoffTime, timezone];
}
