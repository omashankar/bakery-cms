import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/delete_account_cubit.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/delete_account_state.dart';
import 'package:bakery_cms_flutter/features/auth/domain/usecases/delete_account.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockDeleteAccount extends Mock implements DeleteAccount {}

void main() {
  late _MockDeleteAccount deleteAccount;

  setUpAll(() => registerFallbackValue(const NoParams()));
  setUp(() => deleteAccount = _MockDeleteAccount());

  blocTest<DeleteAccountCubit, DeleteAccountState>(
    'a deletion the shop confirms ends in success',
    setUp: () => when(() => deleteAccount(any())).thenAnswer((_) async => const Right(unit)),
    build: () => DeleteAccountCubit(deleteAccount),
    act: (cubit) async => expect(await cubit.delete(), isTrue),
    expect: () => const [
      DeleteAccountState(status: ViewStatus.loading),
      DeleteAccountState(status: ViewStatus.success),
    ],
  );

  blocTest<DeleteAccountCubit, DeleteAccountState>(
    'a refusal reports the shop\'s reason',
    setUp: () => when(
      () => deleteAccount(any()),
    ).thenAnswer((_) async => const Left(ServerFailure('Please try again.'))),
    build: () => DeleteAccountCubit(deleteAccount),
    act: (cubit) async => expect(await cubit.delete(), isFalse),
    expect: () => const [
      DeleteAccountState(status: ViewStatus.loading),
      DeleteAccountState(status: ViewStatus.failure, errorMessage: 'Please try again.'),
    ],
  );

  blocTest<DeleteAccountCubit, DeleteAccountState>(
    'a second tap while deleting sends nothing',
    setUp: () => when(() => deleteAccount(any())).thenAnswer((_) async {
      await Future<void>.delayed(const Duration(milliseconds: 10));
      return const Right(unit);
    }),
    build: () => DeleteAccountCubit(deleteAccount),
    act: (cubit) async {
      final first = cubit.delete();
      expect(await cubit.delete(), isFalse);
      await first;
    },
    verify: (_) => verify(() => deleteAccount(any())).called(1),
  );

  test('the answer still arrives when the screen closed mid-request', () async {
    when(() => deleteAccount(any())).thenAnswer((_) async => const Right(unit));
    final cubit = DeleteAccountCubit(deleteAccount);
    final pending = cubit.delete();
    await cubit.close();
    expect(await pending, isTrue);
  });
}
