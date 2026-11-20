import 'package:bakery_cms_flutter/core/error/server_exception.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/features/delivery_area/data/datasources/pincode_directory_remote_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/delivery_area/data/repositories/pincode_directory_repository_impl.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/pincode_place.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/services/pincode_autofill.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

/// The app asks the PIN directory what the website's `fetchPincodePlace`
/// asks (`GET /api/pincodes?codes=…`) and reads its answer the same way:
/// a place, "no such PIN", or no answer (which is never "not real").
void main() {
  late _MockApiClient client;
  late PincodeDirectoryRepositoryImpl repository;

  setUp(() {
    client = _MockApiClient();
    repository = PincodeDirectoryRepositoryImpl(PincodeDirectoryRemoteDataSourceImpl(client));
  });

  void answers(String code, Object? data) =>
      when(() => client.get('/api/pincodes', query: {'codes': code})).thenAnswer((_) async => data);

  test('a listed PIN: its state and districts, the first district as the city', () async {
    answers('324001', {
      '324001': {
        'kind': 'pin',
        'code': '324001',
        'place': {
          'pincode': '324001',
          'state': 'Rajasthan',
          'districts': ['Kota'],
          'areas': ['Kota', 'Nayapura'],
        },
      },
    });

    final place = (await repository.place('324001')).getRight().toNullable();

    expect(
      place,
      const PincodePlace(
        pincode: '324001',
        state: 'Rajasthan',
        districts: ['Kota'],
        areas: ['Kota', 'Nayapura'],
      ),
    );
    expect(place!.city, 'Kota');
  });

  test('a PIN India Post does not list is an answer: no place', () async {
    answers('999999', {
      '999999': {'kind': 'pin', 'code': '999999', 'place': null},
    });

    final result = await repository.place('999999');

    expect(result.isRight(), isTrue);
    expect(result.getRight().toNullable(), isNull);
  });

  test('no word about the PIN, or no directory, is a failure, never "no such PIN"', () async {
    answers('324001', <String, Object?>{});
    expect((await repository.place('324001')).isLeft(), isTrue);

    when(
      () => client.get('/api/pincodes', query: {'codes': '324002'}),
    ).thenThrow(const ServerException(message: 'down'));
    expect((await repository.place('324002')).getLeft().toNullable(), isA<ServerFailure>());
  });

  test('an answer is remembered for the run; a failure is asked again', () async {
    answers('324001', {
      '324001': {
        'kind': 'pin',
        'place': {
          'pincode': '324001',
          'state': 'Rajasthan',
          'districts': ['Kota'],
        },
      },
    });
    await repository.place('324001');
    await repository.place('324001');
    verify(() => client.get('/api/pincodes', query: {'codes': '324001'})).called(1);

    answers('324002', <String, Object?>{});
    await repository.place('324002');
    await repository.place('324002');
    verify(() => client.get('/api/pincodes', query: {'codes': '324002'})).called(2);
  });

  test('a found value goes only into an empty box', () {
    expect(PincodeAutofill.keep('', 'Kota'), 'Kota');
    expect(PincodeAutofill.keep('  ', 'Kota'), 'Kota');
    expect(PincodeAutofill.keep('Kota City', 'Kota'), 'Kota City');
  });
}
