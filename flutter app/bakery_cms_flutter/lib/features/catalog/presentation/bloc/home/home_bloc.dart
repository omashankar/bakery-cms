import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../../home_layout/domain/usecases/get_home_layout.dart';
import '../../../domain/usecases/get_home_feed.dart';
import '../../../domain/usecases/watch_recently_viewed.dart';
import 'home_event.dart';
import 'home_state.dart';

class HomeBloc extends Bloc<HomeEvent, HomeState> {
  HomeBloc({
    required GetHomeFeed getHomeFeed,
    required GetHomeLayout getHomeLayout,
    required WatchRecentlyViewed watchRecentlyViewed,
  }) : _getHomeFeed = getHomeFeed,
       _getHomeLayout = getHomeLayout,
       _watchRecentlyViewed = watchRecentlyViewed,
       super(const HomeState()) {
    on<HomeStarted>(_onStarted, transformer: droppable());
    on<HomeRefreshed>((_, emit) => _load(emit, forceRefresh: true), transformer: droppable());
  }

  final GetHomeFeed _getHomeFeed;
  final GetHomeLayout _getHomeLayout;
  final WatchRecentlyViewed _watchRecentlyViewed;

  Future<void> _onStarted(HomeStarted event, Emitter<HomeState> emit) async {
    await _load(emit, forceRefresh: false);
    // Opening a product updates "Recently viewed" while the home tab waits
    // underneath, so going back shows it at once.
    await emit.forEach<List<String>>(
      _watchRecentlyViewed(),
      // `copyWith` drops the error unless it is passed on; a history update
      // must not wipe the message of a load that failed.
      onData: (slugs) => state.copyWith(recentSlugs: slugs, errorMessage: state.errorMessage),
    );
  }

  Future<void> _load(Emitter<HomeState> emit, {required bool forceRefresh}) async {
    emit(state.copyWith(status: ViewStatus.loading));
    // Both at once: the layout names products, the feed holds them.
    final layoutCall = _getHomeLayout(forceRefresh);
    final feed = await _getHomeFeed(forceRefresh);
    final layout = await layoutCall;
    feed.match(
      // A failed refresh keeps what is on screen; the page shows a snackbar.
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (feed) => emit(
        state.copyWith(
          status: ViewStatus.success,
          feed: feed,
          // The shop's own page when it could be read; otherwise the rows the
          // app builds itself, rather than an error over a working shop.
          layout: layout.getOrElse((_) => state.layout),
        ),
      ),
    );
  }
}
