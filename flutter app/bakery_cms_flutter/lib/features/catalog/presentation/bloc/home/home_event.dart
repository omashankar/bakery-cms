import 'package:equatable/equatable.dart';

sealed class HomeEvent extends Equatable {
  const HomeEvent();

  @override
  List<Object?> get props => const [];
}

/// First open of the home tab.
final class HomeStarted extends HomeEvent {
  const HomeStarted();
}

/// Pull to refresh, or retry after a failure.
final class HomeRefreshed extends HomeEvent {
  const HomeRefreshed();
}
