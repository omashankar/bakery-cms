import 'package:equatable/equatable.dart';

/// One of the shop's promises ("Same-day delivery", "Free delivery over ₹999").
class HomePromise extends Equatable {
  const HomePromise({required this.kind, required this.title, this.subtitle});

  /// Which promise, so the app can pick an icon: `rating`, `free-delivery`,
  /// `delivery`, ...
  final String kind;
  final String title;
  final String? subtitle;

  @override
  List<Object?> get props => [kind, title, subtitle];
}
