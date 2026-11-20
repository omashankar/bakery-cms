import 'package:bakery_cms_flutter/core/constants/strings/account_strings.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/account/domain/usecases/remove_avatar.dart';
import 'package:bakery_cms_flutter/features/account/domain/usecases/upload_avatar.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/avatar_change.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/avatar_cubit.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/avatar_state.dart';
import 'package:bakery_cms_flutter/features/auth/domain/entities/customer.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_picker.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_source.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../../../auth/auth_fixtures.dart';

class _MockPicker extends Mock implements PhotoPicker {}

class _MockUpload extends Mock implements UploadAvatar {}

class _MockRemove extends Mock implements RemoveAvatar {}

void main() {
  late _MockPicker picker;
  late _MockUpload upload;
  late _MockRemove remove;
  const path = '/cache/me.jpg';
  const busy = AvatarState(status: ViewStatus.loading);

  setUpAll(() {
    registerFallbackValue(PhotoSource.gallery);
    registerFallbackValue(const NoParams());
  });

  setUp(() {
    picker = _MockPicker();
    upload = _MockUpload();
    remove = _MockRemove();
  });

  AvatarCubit build() => AvatarCubit(picker, upload, remove);

  blocTest<AvatarCubit, AvatarState>(
    'a chosen photo uploads with a spinner, then says it was updated',
    setUp: () {
      when(() => picker.pick(PhotoSource.camera)).thenAnswer((_) async => path);
      when(() => upload(path)).thenAnswer((_) async => const Right<Never, Customer>(testCustomer));
    },
    build: build,
    act: (cubit) => cubit.pick(PhotoSource.camera),
    expect: () => [busy, const AvatarState(status: ViewStatus.success, change: AvatarChange.updated)],
  );

  blocTest<AvatarCubit, AvatarState>(
    'backing out of the picker sends nothing',
    setUp: () => when(() => picker.pick(any())).thenAnswer((_) async => null),
    build: build,
    act: (cubit) => cubit.pick(PhotoSource.gallery),
    expect: () => <AvatarState>[],
    verify: (_) => verifyNever(() => upload(any())),
  );

  blocTest<AvatarCubit, AvatarState>(
    'a refused upload shows the shop\'s words',
    setUp: () {
      when(() => picker.pick(any())).thenAnswer((_) async => path);
      when(() => upload(path)).thenAnswer((_) async => const Left(ServerFailure('That file is empty')));
    },
    build: build,
    act: (cubit) => cubit.pick(PhotoSource.gallery),
    expect: () => [
      busy,
      const AvatarState(status: ViewStatus.failure, errorMessage: 'That file is empty'),
    ],
  );

  blocTest<AvatarCubit, AvatarState>(
    'a phone that will not open its photos says so, twice if refused twice',
    setUp: () => when(() => picker.pick(any())).thenThrow(PlatformException(code: 'denied')),
    build: build,
    act: (cubit) async {
      await cubit.pick(PhotoSource.gallery);
      await cubit.pick(PhotoSource.gallery);
    },
    expect: () => [
      const AvatarState(status: ViewStatus.failure, errorMessage: AccountStrings.photoPickFailed),
      const AvatarState(),
      const AvatarState(status: ViewStatus.failure, errorMessage: AccountStrings.photoPickFailed),
    ],
  );

  blocTest<AvatarCubit, AvatarState>(
    'remove takes the photo off and says so',
    setUp: () => when(() => remove(any())).thenAnswer((_) async => const Right<Never, Customer>(testCustomer)),
    build: build,
    act: (cubit) => cubit.remove(),
    expect: () => [busy, const AvatarState(status: ViewStatus.success, change: AvatarChange.removed)],
  );

  blocTest<AvatarCubit, AvatarState>(
    'nothing new starts while a change is in flight',
    build: build,
    seed: () => busy,
    act: (cubit) async {
      await cubit.pick(PhotoSource.gallery);
      await cubit.remove();
    },
    expect: () => <AvatarState>[],
    verify: (_) {
      verifyNever(() => picker.pick(any()));
      verifyNever(() => remove(any()));
    },
  );
}
