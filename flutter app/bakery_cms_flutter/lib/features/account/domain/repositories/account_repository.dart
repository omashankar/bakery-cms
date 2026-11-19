import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../auth/domain/entities/customer.dart';

abstract interface class AccountRepository {
  /// Saves the signed-in customer's own name and phone, and answers the
  /// account as the shop now holds it.
  Future<Either<Failure, Customer>> updateProfile({required String name, String? phone});

  /// Sets the profile photo; answers the account as the shop now holds it.
  Future<Either<Failure, Customer>> uploadAvatar(String filePath);

  /// Removes the profile photo; answers the account as the shop now holds it.
  Future<Either<Failure, Customer>> removeAvatar();
}
