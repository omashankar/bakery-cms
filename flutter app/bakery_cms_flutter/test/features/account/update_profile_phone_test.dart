import 'package:bakery_cms_flutter/features/account/domain/repositories/account_repository.dart';
import 'package:bakery_cms_flutter/features/account/domain/usecases/update_profile.dart';
import 'package:bakery_cms_flutter/features/account/domain/usecases/update_profile_params.dart';
import 'package:bakery_cms_flutter/features/auth/domain/entities/customer.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockRepository extends Mock implements AccountRepository {}

void main() {
  test('an emptied phone is sent as empty, so the shop removes the number', () async {
    final repository = _MockRepository();
    when(() => repository.updateProfile(name: any(named: 'name'), phone: any(named: 'phone')))
        .thenAnswer((_) async => const Right(Customer(id: 'c', email: 'e@x.in', name: 'Riya', phone: '')));

    await UpdateProfile(repository)(const UpdateProfileParams(name: ' Riya ', phone: '  '));

    verify(() => repository.updateProfile(name: 'Riya', phone: '')).called(1);
  });
}
