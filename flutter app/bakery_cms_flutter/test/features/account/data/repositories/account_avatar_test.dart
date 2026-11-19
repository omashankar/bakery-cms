import 'package:bakery_cms_flutter/core/error/server_exception.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/features/account/data/datasources/account_remote_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/account/data/repositories/account_repository_impl.dart';
import 'package:bakery_cms_flutter/features/auth/domain/entities/customer.dart';
import 'package:bakery_cms_flutter/features/auth/domain/repositories/auth_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../../../auth/auth_fixtures.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  late _MockApiClient client;
  late _MockAuthRepository auth;
  late AccountRepositoryImpl repository;
  const file = '/cache/me.jpg';
  const avatar = 'https://cdn.test/avatars/me.jpg';
  const withPhoto = Customer(
    id: 'cust-1',
    email: 'riya@example.com',
    name: 'Riya Sharma',
    phone: '9876543210',
    avatarUrl: avatar,
  );
  const account = {
    'id': 'cust-1',
    'email': 'riya@example.com',
    'name': 'Riya Sharma',
    'phone': '9876543210',
  };

  setUpAll(() => registerFallbackValue(testCustomer));

  setUp(() {
    client = _MockApiClient();
    auth = _MockAuthRepository();
    repository = AccountRepositoryImpl(
      remote: AccountRemoteDataSourceImpl(client),
      authRepository: auth,
    );
  });

  void uploadAnswers(Future<Object?> Function() answer) => when(
        () => client.postMultipart(
          any(),
          field: any(named: 'field'),
          filePath: any(named: 'filePath'),
          filename: any(named: 'filename'),
        ),
      ).thenAnswer((_) => answer());

  test('a new photo is sent as "photo" and becomes the customer everywhere', () async {
    uploadAnswers(() async => {...account, 'avatarUrl': avatar});

    final result = await repository.uploadAvatar(file);

    expect(result, const Right<Never, Customer>(withPhoto));
    verify(
      () => client.postMultipart('/api/customer-auth/avatar', field: 'photo', filePath: file),
    ).called(1);
    verify(() => auth.customerUpdated(withPhoto)).called(1);
  });

  test('removing the photo DELETEs it and the customer loses it everywhere', () async {
    when(() => client.delete(any())).thenAnswer((_) async => account);

    final result = await repository.removeAvatar();

    expect(result, const Right<Never, Customer>(testCustomer));
    verify(() => client.delete('/api/customer-auth/avatar')).called(1);
    verify(() => auth.customerUpdated(testCustomer)).called(1);
  });

  test('a refused photo changes nothing', () async {
    uploadAnswers(() async => throw const ServerException(message: 'That file is empty'));

    final result = await repository.uploadAvatar(file);

    expect(result.getLeft().toNullable(), const ServerFailure('That file is empty'));
    verifyNever(() => auth.customerUpdated(any()));
  });
}
