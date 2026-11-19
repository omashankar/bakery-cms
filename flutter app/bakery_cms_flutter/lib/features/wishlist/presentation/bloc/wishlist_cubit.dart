import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/usecases/remove_from_wishlist.dart';
import '../../domain/usecases/toggle_wishlist.dart';
import '../../domain/usecases/watch_wishlist.dart';
import 'wishlist_state.dart';

/// App-wide wishlist, so every heart on every screen agrees. It follows the
/// repository: a change made anywhere reaches every listener.
class WishlistCubit extends Cubit<WishlistState> {
  WishlistCubit({
    required WatchWishlist watchWishlist,
    required ToggleWishlist toggleWishlist,
    required RemoveFromWishlist removeFromWishlist,
  }) : _watchWishlist = watchWishlist,
       _toggleWishlist = toggleWishlist,
       _removeFromWishlist = removeFromWishlist,
       super(const WishlistState());

  final WatchWishlist _watchWishlist;
  final ToggleWishlist _toggleWishlist;
  final RemoveFromWishlist _removeFromWishlist;

  StreamSubscription<List<String>>? _subscription;

  /// Reads the saved list and follows it from then on.
  void start() {
    _subscription ??= _watchWishlist().listen((slugs) {
      if (!isClosed) emit(WishlistState(slugs: slugs));
    });
  }

  bool isSaved(String slug) => state.contains(slug);

  Future<void> toggle(String slug) => _toggleWishlist(slug);

  Future<void> remove(String slug) => _removeFromWishlist(slug);

  @override
  Future<void> close() async {
    await _subscription?.cancel();
    return super.close();
  }
}
