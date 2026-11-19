import 'dart:async';

import 'package:bakery_cms_flutter/core/constants/strings/catalog_strings.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/photo_frame_shape.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/photo_print_draft.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/services/photo_print_renderer.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/upload_cake_photo.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/cake_photo/cake_photo_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/cake_photo/cake_photo_state.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_picker.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_source.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockPicker extends Mock implements PhotoPicker {}

class _MockUpload extends Mock implements UploadCakePhoto {}

class _MockRenderer extends Mock implements PhotoPrintRenderer {}

/// The website's flow (`photo-print-editor.tsx`): pick, fit in the editor,
/// then upload the flattened PRINT — never the original photo.
void main() {
  late _MockPicker picker;
  late _MockUpload upload;
  late _MockRenderer renderer;
  const source = '/cache/birthday.jpg';
  const print = '/tmp/photo-print-1.jpg';
  const url = 'https://cdn.test/photo-cakes/a.jpg';
  const tooLarge = 'That photo is too large. Please use an image under 6 MB.';
  const named = PhotoPrintDraft(name: 'Riya', zoom: 1.4);

  const editing = CakePhotoState(sourcePath: source, editing: true);
  const printing = CakePhotoState(status: ViewStatus.loading, sourcePath: source, draft: named);
  const uploading = CakePhotoState(
    status: ViewStatus.loading,
    localPath: print,
    sourcePath: source,
    draft: named,
  );
  const uploaded = CakePhotoState(
    status: ViewStatus.success,
    localPath: print,
    url: url,
    sourcePath: source,
    draft: named,
  );
  const failed = CakePhotoState(
    status: ViewStatus.failure,
    localPath: print,
    errorMessage: tooLarge,
    sourcePath: source,
    draft: named,
  );

  setUpAll(() {
    registerFallbackValue(PhotoSource.gallery);
    registerFallbackValue(PhotoFrameShape.circle);
    registerFallbackValue(PhotoPrintDraft.empty);
  });

  setUp(() {
    picker = _MockPicker();
    upload = _MockUpload();
    renderer = _MockRenderer();
    when(
      () => renderer.render(
        sourcePath: any(named: 'sourcePath'),
        shape: any(named: 'shape'),
        draft: any(named: 'draft'),
      ),
    ).thenAnswer((_) async => print);
  });

  CakePhotoCubit build() => CakePhotoCubit(picker, upload, renderer);

  blocTest<CakePhotoCubit, CakePhotoState>(
    'a picked photo opens the editor and uploads nothing yet',
    setUp: () => when(() => picker.pick(PhotoSource.gallery)).thenAnswer((_) async => source),
    build: build,
    act: (cubit) => cubit.pick(PhotoSource.gallery),
    expect: () => [editing],
    verify: (_) => verifyNever(() => upload(any())),
  );

  blocTest<CakePhotoCubit, CakePhotoState>(
    'Use this photo paints the print in the product\'s shape and uploads THAT file',
    setUp: () => when(() => upload(print)).thenAnswer((_) async => const Right(url)),
    build: build,
    seed: () => editing,
    act: (cubit) => cubit.use(named, PhotoFrameShape.heart),
    expect: () => [printing, uploading, uploaded],
    verify: (cubit) {
      verify(
        () => renderer.render(sourcePath: source, shape: PhotoFrameShape.heart, draft: named),
      ).called(1);
      verify(() => upload(print)).called(1);
      verifyNever(() => upload(source));
      expect(cubit.state.isPending, isFalse);
    },
  );

  blocTest<CakePhotoCubit, CakePhotoState>(
    'a print the phone cannot paint says so and uploads nothing',
    setUp: () => when(
      () => renderer.render(
        sourcePath: any(named: 'sourcePath'),
        shape: any(named: 'shape'),
        draft: any(named: 'draft'),
      ),
    ).thenThrow(StateError('no codec')),
    build: build,
    seed: () => editing,
    act: (cubit) => cubit.use(named, PhotoFrameShape.circle),
    expect: () => [
      printing,
      const CakePhotoState(
        sourcePath: source,
        draft: named,
        errorMessage: CatalogStrings.photoPrintFailed,
      ),
    ],
    verify: (_) => verifyNever(() => upload(any())),
  );

  blocTest<CakePhotoCubit, CakePhotoState>(
    'backing out of the picker changes nothing',
    setUp: () => when(() => picker.pick(any())).thenAnswer((_) async => null),
    build: build,
    seed: () => uploaded,
    act: (cubit) => cubit.pick(PhotoSource.camera),
    expect: () => <CakePhotoState>[],
  );

  blocTest<CakePhotoCubit, CakePhotoState>(
    'a new photo keeps the name and resets the fit, and keeps the attached print',
    setUp: () => when(() => picker.pick(any())).thenAnswer((_) async => '/cache/new.jpg'),
    build: build,
    seed: () => uploaded,
    act: (cubit) => cubit.pick(PhotoSource.gallery),
    expect: () => [
      const CakePhotoState(
        status: ViewStatus.success,
        localPath: print,
        url: url,
        sourcePath: '/cache/new.jpg',
        draft: PhotoPrintDraft(name: 'Riya'),
        editing: true,
      ),
    ],
  );

  blocTest<CakePhotoCubit, CakePhotoState>(
    'cancelling the editor over a fresh pick lets the photo go, the name kept',
    build: build,
    seed: () => const CakePhotoState(sourcePath: source, draft: named, editing: true),
    act: (cubit) => cubit.closeEditor(),
    expect: () => [const CakePhotoState(draft: named)],
  );

  blocTest<CakePhotoCubit, CakePhotoState>(
    'cancelling the editor over an attached print keeps the print',
    build: build,
    seed: () => const CakePhotoState(
      status: ViewStatus.success,
      localPath: print,
      url: url,
      sourcePath: source,
      draft: named,
      editing: true,
    ),
    act: (cubit) => cubit.closeEditor(),
    expect: () => [uploaded],
  );

  blocTest<CakePhotoCubit, CakePhotoState>(
    'Edit reopens the editor on the same photo and fit',
    build: build,
    seed: () => uploaded,
    act: (cubit) => cubit.edit(),
    expect: () => [
      const CakePhotoState(
        status: ViewStatus.success,
        localPath: print,
        url: url,
        sourcePath: source,
        draft: named,
        editing: true,
      ),
    ],
  );

  blocTest<CakePhotoCubit, CakePhotoState>(
    'a refused upload says why, holds the cart, and can be retried',
    setUp: () {
      var calls = 0;
      when(() => upload(print)).thenAnswer(
        (_) async => calls++ == 0 ? const Left(ServerFailure(tooLarge)) : const Right(url),
      );
    },
    build: build,
    seed: () => editing,
    act: (cubit) async {
      await cubit.use(named, PhotoFrameShape.circle);
      expect(cubit.state.isPending, isTrue, reason: 'a failed photo must not slip into the cart');
      await cubit.retry();
    },
    expect: () => [printing, uploading, failed, uploading, uploaded],
  );

  blocTest<CakePhotoCubit, CakePhotoState>(
    'a phone that will not open its photos keeps the current photo and says so',
    setUp: () =>
        when(() => picker.pick(any())).thenThrow(PlatformException(code: 'photo_access_denied')),
    build: build,
    seed: () => uploaded,
    act: (cubit) => cubit.pick(PhotoSource.gallery),
    expect: () => [
      const CakePhotoState(
        status: ViewStatus.success,
        localPath: print,
        url: url,
        sourcePath: source,
        draft: named,
        errorMessage: CatalogStrings.photoPickFailed,
      ),
    ],
  );

  blocTest<CakePhotoCubit, CakePhotoState>(
    'the same picker refusal twice is shown twice',
    setUp: () => when(() => picker.pick(any())).thenThrow(PlatformException(code: 'no_camera')),
    build: build,
    act: (cubit) async {
      await cubit.pick(PhotoSource.camera);
      await cubit.pick(PhotoSource.camera);
    },
    expect: () => [
      const CakePhotoState(errorMessage: CatalogStrings.photoPickFailed),
      const CakePhotoState(),
      const CakePhotoState(errorMessage: CatalogStrings.photoPickFailed),
    ],
  );

  test('a photo removed while it uploads stays removed when the answer lands', () async {
    final answer = Completer<Either<ServerFailure, String>>();
    when(() => upload(print)).thenAnswer((_) => answer.future);
    final cubit = build()..emit(editing);

    final using = cubit.use(named, PhotoFrameShape.circle);
    await Future<void>.delayed(Duration.zero);
    expect(cubit.state, uploading);
    cubit.remove();
    answer.complete(const Right(url));
    await using;

    expect(cubit.state, const CakePhotoState());
    await cubit.close();
  });

  blocTest<CakePhotoCubit, CakePhotoState>(
    'retry with nothing failed does nothing',
    build: build,
    seed: () => uploaded,
    act: (cubit) => cubit.retry(),
    expect: () => <CakePhotoState>[],
    verify: (_) => verifyNever(() => upload(any())),
  );

  blocTest<CakePhotoCubit, CakePhotoState>(
    'remove clears the photo',
    build: build,
    seed: () => uploaded,
    act: (cubit) => cubit.remove(),
    expect: () => [const CakePhotoState()],
  );
}
