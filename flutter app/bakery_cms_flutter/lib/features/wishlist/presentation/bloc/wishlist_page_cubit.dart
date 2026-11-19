import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/usecases/get_wishlist_products.dart';
import '../../domain/usecases/watch_wishlist.dart';
import 'wishlist_page_state.dart';

/// The Wishlist screen: the saved slugs as products, redrawn whenever a heart
/// anywhere changes the list.
class WishlistPageCubit extends Cubit<WishlistPageState> {
  WishlistPageCubit({
    required WatchWishlist watchWishlist,
    required GetWishlistProducts getWishlistProducts,
  }) : _watchWishlist = watchWishlist,
       _getWishlistProducts = getWishlistProducts,
       super(const WishlistPageState());

  final WatchWishlist _watchWishlist;
  final GetWishlistProducts _getWishlistProducts;

  StreamSubscription<List<String>>? _subscription;
  List<String> _slugs = const [];

  /// Counts lookups, so an older one that finishes late is ignored.
  int _lookup = 0;

  void start() {
    emit(state.copyWith(status: ViewStatus.loading));
    _subscription ??= _watchWishlist().listen((slugs) {
      _slugs = slugs;
      unawaited(_resolve());
    });
  }

  Future<void> retry() {
    emit(state.copyWith(status: ViewStatus.loading));
    return _resolve();
  }

  Future<void> _resolve() async {
    final lookup = ++_lookup;
    final result = await _getWishlistProducts(_slugs);
    if (isClosed || lookup != _lookup) return;
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (products) => emit(state.copyWith(status: ViewStatus.success, products: products)),
    );
  }

  @override
  Future<void> close() async {
    await _subscription?.cancel();
    return super.close();
  }
}
