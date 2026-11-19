import 'package:equatable/equatable.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../../home_layout/domain/entities/home_layout.dart';
import '../../../domain/entities/home_feed.dart';

class HomeState extends Equatable {
  const HomeState({
    this.status = ViewStatus.initial,
    this.feed = const HomeFeed(),
    this.layout = const HomeLayout(),
    this.recentSlugs = const [],
    this.errorMessage,
  });

  final ViewStatus status;
  final HomeFeed feed;

  /// The page the shop published in its Homepage Builder. Empty when it could
  /// not be read: the page then falls back to rows built from [feed].
  final HomeLayout layout;

  /// What this phone looked at, newest first.
  final List<String> recentSlugs;
  final String? errorMessage;

  HomeState copyWith({
    ViewStatus? status,
    HomeFeed? feed,
    HomeLayout? layout,
    List<String>? recentSlugs,
    String? errorMessage,
  }) {
    return HomeState(
      status: status ?? this.status,
      feed: feed ?? this.feed,
      layout: layout ?? this.layout,
      recentSlugs: recentSlugs ?? this.recentSlugs,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, feed, layout, recentSlugs, errorMessage];
}
