import 'package:bakery_cms_flutter/core/constants/api_endpoints.dart';
import 'package:bakery_cms_flutter/core/error/server_exception.dart';
import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/features/auth/data/datasources/auth_remote_data_source_impl.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

/// The website's `deleteCustomerAccount` believes a deletion only on
/// `data.deleted === true`; anything less must not wipe the phone and say
/// "deleted".
void main() {
  late _MockApiClient client;
  late AuthRemoteDataSourceImpl source;

  setUp(() {
    client = _MockApiClient();
    source = AuthRemoteDataSourceImpl(client);
  });

  void answer(Object? data) =>
      when(() => client.delete(ApiEndpoints.me, fromShop: true)).thenAnswer((_) async => data);

  test('the shop saying deleted: true is a deletion', () async {
    answer({'deleted': true});
    await expectLater(source.deleteAccount(), completes);
    verify(() => client.delete(ApiEndpoints.me, fromShop: true)).called(1);
  });

  for (final reply in <Object?>[
    null,
    <String, dynamic>{},
    {'deleted': false},
    {'deleted': 'true'},
  ]) {
    test('a reply of $reply is not a deletion', () async {
      answer(reply);
      await expectLater(source.deleteAccount(), throwsA(isA<ServerException>()));
    });
  }
}
