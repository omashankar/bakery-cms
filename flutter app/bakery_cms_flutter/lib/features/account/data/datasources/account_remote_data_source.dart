import '../../../auth/data/models/customer_model.dart';

abstract interface class AccountRemoteDataSource {
  Future<CustomerModel> updateProfile({required String name, String? phone});

  /// Sets the profile photo from a file on the phone; answers the account.
  Future<CustomerModel> uploadAvatar(String filePath);

  /// Takes the profile photo off; answers the account.
  Future<CustomerModel> removeAvatar();
}
