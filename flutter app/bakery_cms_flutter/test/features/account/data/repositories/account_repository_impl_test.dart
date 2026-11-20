import 'package:bakery_cms_flutter/core/error/network_exception.dart';
import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/features/account/data/datasources/account_remote_data_source.dart';
import 'package:bakery_cms_flutter/features/account/data/repositories/account_repository_impl.dart';
import 'package:bakery_cms_flutter/features/auth/data/models/customer_model.dart';
import 'package:bakery_cms_flutter/features/auth/domain/entities/customer.dart';
import 'package:bakery_cms_flutter/features/auth/domain/repositories/auth_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../../../auth/auth_fixtures.dart';

class _MockRemote extends Mock implements AccountRemoteDataSource {}

class _MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  late _MockRemote remote;
  late _MockAuthRepository auth;
  late AccountRepositoryImpl repository;

  setUpAll(() => registerFallbackValue(testCustomer));

  setUp(() {
    remote = _MockRemote();
    auth = _MockAuthRepository();
    repository = AccountRepositoryImpl(remote: remote, authRepository: auth);
  });

  test('a saved profile becomes the signed-in customer everywhere', () async {
    when(() => remote.updateProfile(name: any(named: 'name'), phone: any(named: 'phone')))
        .thenAnswer(
      (_) async => CustomerModel.fromJson(const {
        'id': 'cust-1',
        'email': 'riya@example.com',
        'name': 'Riya Sharma',
        'phone': '9876543210',
      }),
    );

    final result = await repository.updateProfile(name: 'Riya Sharma', phone: '9876543210');

    expect(result, const Right<Never, Customer>(testCustomer));
    verify(() => auth.customerUpdated(testCustomer)).called(1);
  });

  test('a failed save changes nothing', () async {
    when(() => remote.updateProfile(name: any(named: 'name'), phone: any(named: 'phone')))
        .thenThrow(const NetworkException());

    final result = await repository.updateProfile(name: 'Riya');

    expect(result, const Left<NetworkFailure, Never>(NetworkFailure()));
    verifyNever(() => auth.customerUpdated(any()));
  });
}
