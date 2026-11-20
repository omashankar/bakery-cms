import 'package:bakery_cms_flutter/features/catalog/data/datasources/recently_viewed_local_data_source.dart';
import 'package:bakery_cms_flutter/features/catalog/data/repositories/recently_viewed_repository_impl.dart';
import 'package:flutter_test/flutter_test.dart';

class _MemorySource implements RecentlyViewedLocalDataSource {
  _MemorySource([this.saved = const []]);

  List<String> saved;

  @override
  List<String> read() => saved;

  @override
  Future<void> write(List<String> slugs) async => saved = slugs;
}

void main() {
  test('the newest view goes first, each product once, and is saved', () async {
    final source = _MemorySource(['b', 'a']);
    final repository = RecentlyViewedRepositoryImpl(source);

    await repository.record('a');

    expect(repository.slugs, ['a', 'b']);
    expect(source.saved, ['a', 'b']);
    await repository.dispose();
  });

  test('the oldest fall off past the limit', () async {
    final repository = RecentlyViewedRepositoryImpl(_MemorySource());
    for (var i = 0; i < RecentlyViewedRepositoryImpl.limit + 5; i++) {
      await repository.record('p$i');
    }
    expect(repository.slugs, hasLength(RecentlyViewedRepositoryImpl.limit));
    expect(repository.slugs.first, 'p${RecentlyViewedRepositoryImpl.limit + 4}');
    await repository.dispose();
  });

  test('every change is announced, so the home tab updates', () async {
    final repository = RecentlyViewedRepositoryImpl(_MemorySource());
    final announced = <List<String>>[];
    final sub = repository.changes.listen(announced.add);

    await repository.record('a');
    await repository.record('a'); // already first: nothing to say
    await Future<void>.delayed(Duration.zero);

    expect(announced, [
      ['a'],
    ]);
    await sub.cancel();
    await repository.dispose();
  });
}
