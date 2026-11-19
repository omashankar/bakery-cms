import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../domain/repositories/wishlist_repository.dart';
import '../datasources/wishlist_local_data_source.dart';

class WishlistRepositoryImpl implements WishlistRepository {
  /// [sessionEnded] fires when a customer's session ends on this phone (sign
  /// out, account deleted, session lapsed); the list is wiped then, as the
  /// website wipes `bakery-cms-wishlist` in `clearLocalCustomerData`.
  WishlistRepositoryImpl(this._local, {Stream<void>? sessionEnded})
    : _slugs = List.unmodifiable(_local.read()) {
    _sessionSubscription = sessionEnded?.listen((_) => clear());
  }

  final WishlistLocalDataSource _local;
  StreamSubscription<void>? _sessionSubscription;
  final StreamController<List<String>> _changes = StreamController.broadcast();
  List<String> _slugs;

  @override
  List<String> get slugs => _slugs;

  @override
  Stream<List<String>> get changes => _changes.stream;

  @override
  Future<void> toggle(String slug) {
    if (slug.isEmpty) return Future.value();
    final saved = _slugs.contains(slug);
    return _apply(saved ? _without(slug) : [slug, ..._slugs]);
  }

  @override
  Future<void> remove(String slug) {
    if (!_slugs.contains(slug)) return Future.value();
    return _apply(_without(slug));
  }

  @override
  Future<void> clear() => _slugs.isEmpty ? Future.value() : _apply(const []);

  List<String> _without(String slug) => _slugs.where((s) => s != slug).toList();

  /// The heart changes at once; the phone's copy follows.
  Future<void> _apply(List<String> next) async {
    _slugs = List.unmodifiable(next);
    _changes.add(_slugs);
    try {
      await _local.write(_slugs);
    } catch (error) {
      // The list on screen is still right for this session.
      debugPrint('Could not save the wishlist: $error');
    }
  }

  @visibleForTesting
  Future<void> dispose() async {
    await _sessionSubscription?.cancel();
    await _changes.close();
  }
}
