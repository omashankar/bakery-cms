import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/pincode_place.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/usecases/find_pincode_place.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/pincode_place_bloc.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/pincode_place_event.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/pincode_place_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockFindPincodePlace extends Mock implements FindPincodePlace {}

/// An address form's PIN lookup: debounced, the newest PIN wins, and a
/// directory that cannot be asked is a quiet failure.
void main() {
  late _MockFindPincodePlace find;

  const kota = PincodePlace(pincode: '324001', state: 'Rajasthan', districts: ['Kota']);
  const pause = Duration(milliseconds: 30);

  setUp(() {
    find = _MockFindPincodePlace();
    when(() => find('324001')).thenAnswer((_) async => const Right(kota));
  });

  PincodePlaceBloc build() => PincodePlaceBloc(find, pause: pause);

  blocTest<PincodePlaceBloc, PincodePlaceState>(
    'a full PIN is looked up once typing pauses',
    build: build,
    act: (bloc) => bloc.add(const PincodePlaceTyped('324001')),
    wait: pause * 3,
    expect: () => const [
      PincodePlaceState(status: ViewStatus.loading, pincode: '324001'),
      PincodePlaceState(status: ViewStatus.success, pincode: '324001', place: kota),
    ],
    verify: (_) => verify(() => find('324001')).called(1),
  );

  blocTest<PincodePlaceBloc, PincodePlaceState>(
    'five digits, or a PIN starting with 0, is still typing: nothing asked',
    build: build,
    act: (bloc) => bloc
      ..add(const PincodePlaceTyped('32400'))
      ..add(const PincodePlaceTyped('024001')),
    wait: pause * 3,
    expect: () => const [PincodePlaceState(pincode: '32400'), PincodePlaceState(pincode: '024001')],
    verify: (_) => verifyNever(() => find(any())),
  );

  blocTest<PincodePlaceBloc, PincodePlaceState>(
    'a newer PIN within the pause cancels the older one: only the last is asked',
    setUp: () => when(
      () => find('324002'),
    ).thenAnswer((_) async => const Right(PincodePlace(pincode: '324002', state: 'Rajasthan'))),
    build: build,
    act: (bloc) => bloc
      ..add(const PincodePlaceTyped('324001'))
      ..add(const PincodePlaceTyped('324002')),
    wait: pause * 3,
    verify: (bloc) {
      verifyNever(() => find('324001'));
      verify(() => find('324002')).called(1);
      expect(bloc.state.pincode, '324002');
      expect(bloc.state.status, ViewStatus.success);
    },
  );

  blocTest<PincodePlaceBloc, PincodePlaceState>(
    'the same PIN reported again (a cursor move) does not restart the wait',
    build: build,
    act: (bloc) async {
      bloc.add(const PincodePlaceTyped('324001'));
      await Future<void>.delayed(pause ~/ 2);
      bloc.add(const PincodePlaceTyped('324001'));
    },
    wait: pause * 3,
    verify: (bloc) {
      verify(() => find('324001')).called(1);
      expect(bloc.state.place, kota);
    },
  );

  blocTest<PincodePlaceBloc, PincodePlaceState>(
    'no directory: a failure with no place, which a form keeps to itself',
    setUp: () => when(() => find('324001')).thenAnswer((_) async => const Left(NetworkFailure())),
    build: build,
    act: (bloc) => bloc.add(const PincodePlaceTyped('324001')),
    wait: pause * 3,
    expect: () => const [
      PincodePlaceState(status: ViewStatus.loading, pincode: '324001'),
      PincodePlaceState(status: ViewStatus.failure, pincode: '324001'),
    ],
  );
}
