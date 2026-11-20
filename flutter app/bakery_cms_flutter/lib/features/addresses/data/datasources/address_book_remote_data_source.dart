import '../models/saved_address_model.dart';

abstract interface class AddressBookRemoteDataSource {
  Future<List<SavedAddressModel>> fetch();

  /// Replaces the whole book; answers with the book as stored.
  Future<List<SavedAddressModel>> replace(List<SavedAddressModel> addresses);
}
