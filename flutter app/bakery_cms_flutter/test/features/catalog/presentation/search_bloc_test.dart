import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/search_products.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/search/search_bloc.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/search/search_event.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/search/search_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../catalog_fixtures.dart';

class _MockSearchProducts extends Mock implements SearchProducts {}

void main() {
  late _MockSearchProducts search;

  setUp(() {
    search = _MockSearchProducts();
    when(() => search(any())).thenAnswer((_) async => const Right([CatalogFixtures.truffleCake]));
  });

  blocTest<SearchBloc, SearchState>(
    'fast typing searches only the last query',
    build: () => SearchBloc(search, debounce: const Duration(milliseconds: 20)),
    act: (bloc) async {
      bloc
        ..add(const SearchQueryChanged('t'))
        ..add(const SearchQueryChanged('tr'))
        ..add(const SearchQueryChanged('truffle'));
    },
    wait: const Duration(milliseconds: 80),
    expect: () => const [
      SearchState(status: ViewStatus.loading, query: 't'),
      SearchState(status: ViewStatus.loading, query: 'tr'),
      SearchState(status: ViewStatus.loading, query: 'truffle'),
      SearchState(
        status: ViewStatus.success,
        query: 'truffle',
        results: [CatalogFixtures.truffleCake],
      ),
    ],
    verify: (_) {
      verify(() => search('truffle')).called(1);
      verifyNever(() => search('t'));
    },
  );

  blocTest<SearchBloc, SearchState>(
    'clearing the box resets to the prompt',
    build: () => SearchBloc(search, debounce: Duration.zero),
    seed: () => const SearchState(status: ViewStatus.success, query: 'x'),
    act: (bloc) => bloc.add(const SearchQueryChanged('  ')),
    expect: () => const [SearchState()],
  );
}
