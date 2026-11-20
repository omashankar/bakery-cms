import 'dart:async';

import 'package:bakery_cms_flutter/core/error/failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/geo_point.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/failures/location_failure.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/get_current_location.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/get_current_location_params.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/map_picker_cubit.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/map_picker_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockGetCurrentLocation extends Mock implements GetCurrentLocation {}

/// The map never shows the location prompt by itself: the privacy policy
/// promises the app asks only when "Use my current location" is tapped.
void main() {
  late _MockGetCurrentLocation getLocation;
  const home = GeoPoint(lat: 25.18, lng: 75.83);
  const start = MapPickerCubit.defaultCenter;

  setUpAll(() => registerFallbackValue(const GetCurrentLocationParams(askPermission: false)));
  setUp(() => getLocation = _MockGetCurrentLocation());

  blocTest<MapPickerCubit, MapPickerState>(
    'opening the map looks up the position without asking',
    setUp: () => when(() => getLocation(any())).thenAnswer((_) async => const Right(home)),
    build: () => MapPickerCubit(getLocation),
    act: (cubit) => cubit.locateIfAllowed(),
    expect: () => const [MapPickerState(center: home, recenterId: 1)],
    verify: (_) =>
        verify(() => getLocation(const GetCurrentLocationParams(askPermission: false))).called(1),
  );

  blocTest<MapPickerCubit, MapPickerState>(
    'a customer who never allowed location sees no error for it',
    setUp: () => when(
      () => getLocation(any()),
    ).thenAnswer((_) async => const Left(LocationFailure('Location permission was not given.'))),
    build: () => MapPickerCubit(getLocation),
    act: (cubit) => cubit.locateIfAllowed(),
    expect: () => const <MapPickerState>[],
  );

  blocTest<MapPickerCubit, MapPickerState>(
    '"Use my current location" is the one that asks',
    setUp: () => when(() => getLocation(any())).thenAnswer((_) async => const Right(home)),
    build: () => MapPickerCubit(getLocation),
    act: (cubit) => cubit.locate(),
    expect: () => const [
      MapPickerState(center: start, locateStatus: ViewStatus.loading),
      MapPickerState(center: home, locateStatus: ViewStatus.success, recenterId: 1),
    ],
    verify: (_) =>
        verify(() => getLocation(const GetCurrentLocationParams(askPermission: true))).called(1),
  );

  test('a late answer does not drag back a pin the customer already moved', () async {
    final answer = Completer<Either<Failure, GeoPoint>>();
    when(() => getLocation(any())).thenAnswer((_) => answer.future);
    final cubit = MapPickerCubit(getLocation);
    const moved = GeoPoint(lat: 25.2, lng: 75.9);

    final lookup = cubit.locateIfAllowed();
    cubit.moved(moved);
    answer.complete(const Right(home));
    await lookup;

    expect(cubit.state.center, moved);
    expect(cubit.state.recenterId, 0);
    await cubit.close();
  });
}
