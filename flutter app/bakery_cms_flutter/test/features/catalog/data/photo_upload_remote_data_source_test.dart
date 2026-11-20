import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/features/catalog/data/datasources/photo_upload_remote_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/catalog/data/repositories/photo_upload_repository_impl.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  late _MockApiClient client;
  late PhotoUploadRepositoryImpl repository;
  const file = '/cache/birthday.jpg';

  setUp(() {
    client = _MockApiClient();
    repository = PhotoUploadRepositoryImpl(PhotoUploadRemoteDataSourceImpl(client));
  });

  void answers(Object? data) => when(
    () => client.postMultipart(
      any(),
      field: any(named: 'field'),
      filePath: any(named: 'filePath'),
      filename: any(named: 'filename'),
    ),
  ).thenAnswer((_) async => data);

  test('uploads to the photo-cake endpoint as "photo" and answers its URL', () async {
    answers({'url': 'https://cdn.test/a.jpg', 'bytes': 1024});

    final result = await repository.uploadCakePhoto(file);

    expect(result, const Right<Never, String>('https://cdn.test/a.jpg'));
    verify(
      () => client.postMultipart('/api/uploads/photo-cake', field: 'photo', filePath: file),
    ).called(1);
  });

  test('an answer with no URL is a failure, not an empty photo', () async {
    answers({'bytes': 1024});

    final result = await repository.uploadCakePhoto(file);

    expect(result.getLeft().toNullable(), isA<ServerFailure>());
  });
}
