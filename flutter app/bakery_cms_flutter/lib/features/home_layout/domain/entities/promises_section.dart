import 'home_promise.dart';
import 'home_section.dart';

/// A strip of the shop's promises: rating, delivery, free delivery.
class PromisesSection extends HomeSection {
  const PromisesSection({
    required super.id,
    required this.items,
    super.tone,
    super.overline,
    super.title,
    super.description,
    super.cta,
  });

  final List<HomePromise> items;

  @override
  List<Object?> get props => [...sectionProps, items];
}
