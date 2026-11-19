import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/account/domain/usecases/update_profile.dart';
import 'package:bakery_cms_flutter/features/account/domain/usecases/update_profile_params.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/profile_cubit.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/profile_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../../../auth/auth_fixtures.dart';

class _MockUpdateProfile extends Mock implements UpdateProfile {}

void main() {
  late _MockUpdateProfile updateProfile;
  const refused = ServerFailure('Please enter your name');

  setUpAll(() => registerFallbackValue(const UpdateProfileParams(name: 'x')));
  setUp(() => updateProfile = _MockUpdateProfile());

  blocTest<ProfileCubit, ProfileState>(
    'saves the profile',
    setUp: () => when(() => updateProfile(any())).thenAnswer((_) async => const Right(testCustomer)),
    build: () => ProfileCubit(updateProfile),
    act: (cubit) => cubit.save(name: 'Riya Sharma', phone: '9876543210'),
    expect: () => [
      const ProfileState(status: ViewStatus.loading),
      const ProfileState(status: ViewStatus.success),
    ],
    verify: (_) => verify(
      () => updateProfile(const UpdateProfileParams(name: 'Riya Sharma', phone: '9876543210')),
    ).called(1),
  );

  blocTest<ProfileCubit, ProfileState>(
    'a refused save carries the shop’s message',
    setUp: () => when(() => updateProfile(any())).thenAnswer((_) async => const Left(refused)),
    build: () => ProfileCubit(updateProfile),
    act: (cubit) => cubit.save(name: ''),
    expect: () => [
      const ProfileState(status: ViewStatus.loading),
      ProfileState(status: ViewStatus.failure, errorMessage: refused.message),
    ],
  );
}
