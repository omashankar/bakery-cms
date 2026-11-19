import 'package:bakery_cms_flutter/core/error/cache_failure.dart';
import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/delivery_area.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/delivery_verdict.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/usecases/check_delivery_area.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/usecases/load_delivery_area.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/usecases/save_delivery_area.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_cubit.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_state.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_status.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/pincode_check_cubit.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/pincode_check_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockLoad extends Mock implements LoadDeliveryArea {}

class _MockSave extends Mock implements SaveDeliveryArea {}

class _MockCheck extends Mock implements CheckDeliveryArea {}

void main() {
  late _MockLoad load;
  late _MockSave save;
  late _MockCheck check;

  const kota = DeliveryArea(
    pincode: '324002',
    verdict: DeliveryVerdict.eligible,
    city: 'Kota',
    charge: 99,
    minDeliveryDays: 1,
  );
  const mumbai = DeliveryArea(pincode: '400001', verdict: DeliveryVerdict.outside);
  const parts = DeliveryArea(pincode: '324001', verdict: DeliveryVerdict.partly);
  const nowhere = DeliveryArea(pincode: '325600', verdict: DeliveryVerdict.unknown);

  setUpAll(() {
    registerFallbackValue(const NoParams());
    registerFallbackValue(kota);
  });

  setUp(() {
    load = _MockLoad();
    save = _MockSave();
    check = _MockCheck();
    when(() => load(any())).thenAnswer((_) async => const Right(null));
    when(() => save(any())).thenAnswer((_) async => const Right(unit));
  });

  DeliveryAreaCubit build() =>
      DeliveryAreaCubit(loadDeliveryArea: load, saveDeliveryArea: save, checkDeliveryArea: check);

  group('DeliveryAreaCubit', () {
    test('starts with none chosen', () {
      expect(build().state, const DeliveryAreaState());
    });

    blocTest<DeliveryAreaCubit, DeliveryAreaState>(
      'load: nothing kept stays none chosen, without asking the shop',
      build: build,
      act: (cubit) => cubit.load(),
      expect: () => [const DeliveryAreaState()],
      verify: (_) => verifyNever(() => check(any())),
    );

    blocTest<DeliveryAreaCubit, DeliveryAreaState>(
      'load: the kept area shows as it was answered, without a request',
      setUp: () => when(() => load(any())).thenAnswer((_) async => const Right(kota)),
      build: build,
      act: (cubit) => cubit.load(),
      expect: () => [const DeliveryAreaState(status: DeliveryAreaStatus.delivers, area: kota)],
      verify: (_) => verifyNever(() => check(any())),
    );

    blocTest<DeliveryAreaCubit, DeliveryAreaState>(
      'load: what cannot be read counts as none chosen',
      setUp: () => when(() => load(any())).thenAnswer((_) async => const Left(CacheFailure())),
      build: build,
      act: (cubit) => cubit.load(),
      expect: () => [const DeliveryAreaState()],
    );

    blocTest<DeliveryAreaCubit, DeliveryAreaState>(
      'save: shown at once and kept on the device',
      build: build,
      act: (cubit) => cubit.save(kota),
      expect: () => [const DeliveryAreaState(status: DeliveryAreaStatus.delivers, area: kota)],
      verify: (_) => verify(() => save(kota)).called(1),
    );

    blocTest<DeliveryAreaCubit, DeliveryAreaState>(
      'save: each verdict has its own status',
      build: build,
      act: (cubit) async {
        await cubit.save(mumbai);
        await cubit.save(parts);
        await cubit.save(nowhere);
      },
      expect: () => [
        const DeliveryAreaState(status: DeliveryAreaStatus.notDelivered, area: mumbai),
        const DeliveryAreaState(status: DeliveryAreaStatus.partly, area: parts),
        const DeliveryAreaState(status: DeliveryAreaStatus.notDelivered, area: nowhere),
      ],
    );

    blocTest<DeliveryAreaCubit, DeliveryAreaState>(
      'save: a device that cannot keep it still uses it for this visit',
      setUp: () => when(() => save(any())).thenAnswer((_) async => const Left(CacheFailure())),
      build: build,
      act: (cubit) => cubit.save(kota),
      expect: () => [const DeliveryAreaState(status: DeliveryAreaStatus.delivers, area: kota)],
    );

    blocTest<DeliveryAreaCubit, DeliveryAreaState>(
      'a choice made while the device was being read is not overwritten by it',
      setUp: () => when(() => load(any())).thenAnswer((_) async => const Right(mumbai)),
      build: build,
      act: (cubit) async {
        final loading = cubit.load();
        await cubit.save(kota);
        await loading;
      },
      expect: () => [const DeliveryAreaState(status: DeliveryAreaStatus.delivers, area: kota)],
    );

    blocTest<DeliveryAreaCubit, DeliveryAreaState>(
      'refresh: checking, then the new answer, which is kept',
      setUp: () => when(() => check('324002')).thenAnswer((_) async => const Right(mumbai)),
      build: build,
      seed: () => const DeliveryAreaState(status: DeliveryAreaStatus.delivers, area: kota),
      act: (cubit) => cubit.refresh(),
      expect: () => [
        const DeliveryAreaState(status: DeliveryAreaStatus.checking, area: kota),
        const DeliveryAreaState(status: DeliveryAreaStatus.notDelivered, area: mumbai),
      ],
      verify: (_) => verify(() => save(mumbai)).called(1),
    );

    blocTest<DeliveryAreaCubit, DeliveryAreaState>(
      'refresh: a failure keeps the chosen area on screen, with the reason',
      setUp: () => when(() => check(any())).thenAnswer((_) async => const Left(NetworkFailure())),
      build: build,
      seed: () => const DeliveryAreaState(status: DeliveryAreaStatus.delivers, area: kota),
      act: (cubit) => cubit.refresh(),
      expect: () => [
        const DeliveryAreaState(status: DeliveryAreaStatus.checking, area: kota),
        DeliveryAreaState(
          status: DeliveryAreaStatus.failure,
          area: kota,
          errorMessage: const NetworkFailure().message,
        ),
      ],
      verify: (_) => verifyNever(() => save(any())),
    );

    blocTest<DeliveryAreaCubit, DeliveryAreaState>(
      'retry asks about the same PIN code again',
      setUp: () => when(() => check('324002')).thenAnswer((_) async => const Right(kota)),
      build: build,
      seed: () => const DeliveryAreaState(
        status: DeliveryAreaStatus.failure,
        area: kota,
        errorMessage: 'offline',
      ),
      act: (cubit) => cubit.retry(),
      expect: () => [
        const DeliveryAreaState(status: DeliveryAreaStatus.checking, area: kota),
        const DeliveryAreaState(status: DeliveryAreaStatus.delivers, area: kota),
      ],
      verify: (_) => verify(() => check('324002')).called(1),
    );

    blocTest<DeliveryAreaCubit, DeliveryAreaState>(
      'refresh with none chosen asks nothing',
      build: build,
      act: (cubit) => cubit.refresh(),
      expect: () => <DeliveryAreaState>[],
      verify: (_) => verifyNever(() => check(any())),
    );

    test('the area days count only where the shop delivers', () {
      expect(const DeliveryAreaState(area: kota).minDeliveryDays, 1);
      expect(
        const DeliveryAreaState(
          area: DeliveryArea(pincode: '1', verdict: DeliveryVerdict.outside, minDeliveryDays: 4),
        ).minDeliveryDays,
        isNull,
      );
      expect(const DeliveryAreaState(area: mumbai).isNotDelivered, isTrue);
      expect(const DeliveryAreaState(area: nowhere).isNotDelivered, isTrue);
      expect(const DeliveryAreaState(area: parts).isNotDelivered, isFalse);
      expect(const DeliveryAreaState().isNotDelivered, isFalse);
    });
  });

  group('PincodeCheckCubit', () {
    blocTest<PincodeCheckCubit, PincodeCheckState>(
      'check: loading, then the answer; nothing is kept',
      setUp: () => when(() => check('324002')).thenAnswer((_) async => const Right(kota)),
      build: () => PincodeCheckCubit(check),
      act: (cubit) => cubit.check(' 324002 '),
      expect: () => [
        const PincodeCheckState(status: ViewStatus.loading, pincode: '324002'),
        const PincodeCheckState(status: ViewStatus.success, pincode: '324002', answer: kota),
      ],
      verify: (_) => verifyNever(() => save(any())),
    );

    blocTest<PincodeCheckCubit, PincodeCheckState>(
      'check: a failure says why, and retry asks again',
      setUp: () {
        var calls = 0;
        when(
          () => check('324002'),
        ).thenAnswer((_) async => calls++ == 0 ? const Left(NetworkFailure()) : const Right(kota));
      },
      build: () => PincodeCheckCubit(check),
      act: (cubit) async {
        await cubit.check('324002');
        await cubit.retry();
      },
      expect: () => [
        const PincodeCheckState(status: ViewStatus.loading, pincode: '324002'),
        PincodeCheckState(
          status: ViewStatus.failure,
          pincode: '324002',
          errorMessage: const NetworkFailure().message,
        ),
        const PincodeCheckState(status: ViewStatus.loading, pincode: '324002'),
        const PincodeCheckState(status: ViewStatus.success, pincode: '324002', answer: kota),
      ],
    );

    blocTest<PincodeCheckCubit, PincodeCheckState>(
      'an answer that arrives after the PIN code was edited is dropped',
      setUp: () => when(() => check('324002')).thenAnswer((_) async => const Right(kota)),
      build: () => PincodeCheckCubit(check),
      act: (cubit) async {
        final asking = cubit.check('324002');
        cubit.reset();
        await asking;
      },
      expect: () => [
        const PincodeCheckState(status: ViewStatus.loading, pincode: '324002'),
        const PincodeCheckState(),
      ],
    );
  });
}
