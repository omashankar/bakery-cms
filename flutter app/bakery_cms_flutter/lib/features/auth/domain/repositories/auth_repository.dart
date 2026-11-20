import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/customer.dart';

/// Who is signed in. The repository is the single owner of that answer:
/// it emits on [customerChanges] when someone signs in, signs out, edits
/// their profile, or when the shop stops recognising the session (any 401).
abstract interface class AuthRepository {
  /// Broadcast. Emits the customer after each change, or null when signed out.
  Stream<Customer?> get customerChanges;

  Customer? get currentCustomer;

  /// Broadcast. Emits each time this device stops holding a customer's
  /// session: [signOut], a confirmed [deleteAccount], a 401 (or the
  /// account-gone 403), or a restore that finds the shop no longer knows the
  /// session cookie this device kept. Never for a visitor who was not signed
  /// in. Whatever the device holds on the customer's behalf (cart, wishlist)
  /// is wiped on it, as the website's `clearLocalCustomerData` does.
  Stream<void> get sessionEnded;

  /// Asks the shop whether the saved session cookie still signs someone in.
  /// Resolves to null (not a failure) for a signed-out visitor.
  Future<Either<Failure, Customer?>> restoreSession();

  Future<Either<Failure, Unit>> requestCode({required String email, String? name});

  Future<Either<Failure, Customer>> verifyCode({required String email, required String code});

  /// Always signs the device out, even if the shop could not be reached.
  Future<Either<Failure, Unit>> signOut();

  /// Deletes the account on the shop, then forgets it on this device. Unlike
  /// [signOut], nothing is forgotten unless the shop confirms the deletion:
  /// a customer must never be told "deleted" over an account that is not.
  Future<Either<Failure, Unit>> deleteAccount();

  /// For a profile edit saved elsewhere: makes [customer] the current one.
  void customerUpdated(Customer customer);
}
