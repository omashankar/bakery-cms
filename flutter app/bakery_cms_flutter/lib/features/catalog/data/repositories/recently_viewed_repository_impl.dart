import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../domain/repositories/recently_viewed_repository.dart';
import '../datasources/recently_viewed_local_data_source.dart';

class RecentlyViewedRepositoryImpl implements RecentlyViewedRepository {
  RecentlyViewedRepositoryImpl(this._local) : _slugs = List.unmodifiable(_local.read());

  final RecentlyViewedLocalDataSource _local;
  final StreamController<List<String>> _changes = StreamController.broadcast();
  List<String> _slugs;

  /// More than any home row shows; the oldest fall off.
  static const int limit = 20;

  @override
  List<String> get slugs => _slugs;

  @override
  Stream<List<String>> get changes => _changes.stream;

  @override
  Future<void> record(String slug) async {
    if (slug.isEmpty || (_slugs.isNotEmpty && _slugs.first == slug)) return;
    _slugs = List.unmodifiable([slug, ..._slugs.where((s) => s != slug)].take(limit));
    _changes.add(_slugs);
    try {
      await _local.write(_slugs);
    } catch (error) {
      // History is a convenience: failing to save it must not break a page.
      debugPrint('Could not save recently viewed products: $error');
    }
  }

  @visibleForTesting
  Future<void> dispose() => _changes.close();
}
