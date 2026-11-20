import 'package:bakery_cms_flutter/features/wishlist/data/datasources/wishlist_local_data_source.dart';
import 'package:bakery_cms_flutter/features/wishlist/data/datasources/wishlist_local_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/wishlist/data/repositories/wishlist_repository_impl.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/watch_wishlist.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MemorySource implements WishlistLocalDataSource {
  _MemorySource([this.saved = const []]);

  List<String> saved;

  @override
  List<String> read() => saved;

  @override
  Future<void> write(List<String> slugs) async => saved = slugs;
}

class _BrokenSource extends _MemorySource {
  @override
  Future<void> write(List<String> slugs) async => throw StateError('disk full');
}

void main() {
  group('WishlistRepositoryImpl', () {
    test('a newly saved product goes first and is saved to the phone', () async {
      final source = _MemorySource(['b', 'a']);
      final repository = WishlistRepositoryImpl(source);

      await repository.toggle('c');

      expect(repository.slugs, ['c', 'b', 'a']);
      expect(source.saved, ['c', 'b', 'a']);
      await repository.dispose();
    });

    test('toggling a saved product forgets it and keeps the rest in order', () async {
      final source = _MemorySource(['c', 'b', 'a']);
      final repository = WishlistRepositoryImpl(source);

      await repository.toggle('b');

      expect(repository.slugs, ['c', 'a']);
      expect(source.saved, ['c', 'a']);
      await repository.dispose();
    });

    test('remove forgets a product and is a no-op for one never saved', () async {
      final source = _MemorySource(['b', 'a']);
      final repository = WishlistRepositoryImpl(source);
      final announced = <List<String>>[];
      final sub = repository.changes.listen(announced.add);

      await repository.remove('a');
      await repository.remove('zzz');
      await Future<void>.delayed(Duration.zero);

      expect(repository.slugs, ['b']);
      expect(announced, [
        ['b'],
      ]);
      await sub.cancel();
      await repository.dispose();
    });

    test('an empty slug is ignored', () async {
      final repository = WishlistRepositoryImpl(_MemorySource());
      await repository.toggle('');
      expect(repository.slugs, isEmpty);
      await repository.dispose();
    });

    test('every change is announced, so every heart updates', () async {
      final repository = WishlistRepositoryImpl(_MemorySource());
      final announced = <List<String>>[];
      final sub = repository.changes.listen(announced.add);

      await repository.toggle('a');
      await repository.toggle('b');
      await repository.toggle('a');
      await Future<void>.delayed(Duration.zero);

      expect(announced, [
        ['a'],
        ['b', 'a'],
        ['b'],
      ]);
      await sub.cancel();
      await repository.dispose();
    });

    test('a failed save still changes the list for this session', () async {
      final repository = WishlistRepositoryImpl(_BrokenSource());
      await repository.toggle('a');
      expect(repository.slugs, ['a']);
      await repository.dispose();
    });

    test('the list survives a restart: a new repository reads what the last one saved', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final first = WishlistRepositoryImpl(WishlistLocalDataSourceImpl(prefs));
      await first.toggle('a');
      await first.toggle('b');
      await first.dispose();

      final second = WishlistRepositoryImpl(WishlistLocalDataSourceImpl(prefs));

      expect(prefs.getStringList(WishlistLocalDataSourceImpl.key), ['b', 'a']);
      expect(WishlistLocalDataSourceImpl.key, 'wishlist_products');
      expect(second.slugs, ['b', 'a']);
      await second.dispose();
    });
  });

  test('WatchWishlist gives the saved list first, then every change', () async {
    final repository = WishlistRepositoryImpl(_MemorySource(['a']));
    final seen = <List<String>>[];
    final sub = WatchWishlist(repository)().listen(seen.add);
    await Future<void>.delayed(Duration.zero);

    await repository.toggle('b');
    await Future<void>.delayed(Duration.zero);

    expect(seen, [
      ['a'],
      ['b', 'a'],
    ]);
    await sub.cancel();
    await repository.dispose();
  });
}
