/// The ground a home section is drawn on, as the shop chose it in the
/// Homepage Builder (`SectionBackground` on the website).
enum SectionTone {
  plain('white'),
  cream('cream'),
  panel('panel'),
  rose('panel-rose'),
  mint('panel-mint'),
  sand('panel-sand'),
  sky('panel-sky');

  const SectionTone(this.apiValue);

  final String apiValue;

  /// Anything unknown reads as the plain page.
  static SectionTone fromApi(Object? value) => SectionTone.values.firstWhere(
    (tone) => tone.apiValue == value,
    orElse: () => SectionTone.plain,
  );

  /// A tinted card inset from the edges, rather than a full-width band.
  bool get isPanel => this != plain && this != cream;
}
