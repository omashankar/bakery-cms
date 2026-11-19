import '../models/customer_model.dart';

/// Throws the app's typed exceptions; never returns a failure.
abstract interface class AuthRemoteDataSource {
  Future<void> requestCode({required String email, String? name});

  /// Sets the session cookie (kept by the cookie jar) and answers who it is.
  Future<CustomerModel?> verifyCode({required String email, required String code});

  /// Null when no one is signed in on this device.
  Future<CustomerModel?> fetchCurrentCustomer();

  Future<void> logout();

  /// Deletes the signed-in customer's account on the shop, for good.
  Future<void> deleteAccount();
}
