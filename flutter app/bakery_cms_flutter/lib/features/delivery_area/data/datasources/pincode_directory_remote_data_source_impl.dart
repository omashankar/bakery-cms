import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/pincode_place_model.dart';
import 'pincode_directory_remote_data_source.dart';

/// `GET /api/pincodes?codes=324001`, the request the website's
/// `fetchPincodePlace` makes. The answer is keyed by code:
/// `{"324001": {"kind": "pin", "code": "324001", "place": {…} | null}}`.
class PincodeDirectoryRemoteDataSourceImpl implements PincodeDirectoryRemoteDataSource {
  const PincodeDirectoryRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  static const String _codesKey = 'codes';
  static const String _kindKey = 'kind';
  static const String _pinKind = 'pin';
  static const String _placeKey = 'place';

  @override
  Future<PincodePlaceModel?> place(String pincode) async {
    final data = await _client.get(ApiEndpoints.pincodes, query: {_codesKey: pincode});
    final entry = data is Map<String, dynamic> ? data[pincode] : null;
    // No word about this PIN as a PIN is no answer, not "no such PIN".
    if (entry is! Map<String, dynamic> || entry[_kindKey] != _pinKind) {
      throw const ServerException();
    }
    final place = entry[_placeKey];
    if (place == null) return null;
    if (place is! Map<String, dynamic>) throw const ServerException();
    return PincodePlaceModel.fromJson(place);
  }
}
