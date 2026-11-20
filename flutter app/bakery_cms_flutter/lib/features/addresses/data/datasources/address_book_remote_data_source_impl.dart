import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../../../core/error/app_exception.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_envelope.dart';
import '../models/saved_address_model.dart';
import 'address_book_remote_data_source.dart';

/// `GET` / `PUT /api/customer-auth/addresses`, keyed on the session cookie.
///
/// The PUT goes through [Dio] directly because [ApiClient] has no `put` yet;
/// it unwraps and maps errors exactly as [ApiClient] does.
class AddressBookRemoteDataSourceImpl implements AddressBookRemoteDataSource {
  const AddressBookRemoteDataSourceImpl(this._client, this._dio);

  /// Belongs in `ApiEndpoints` (core), which this feature does not edit.
  static const String path = '/api/customer-auth/addresses';

  final ApiClient _client;
  final Dio _dio;

  @override
  Future<List<SavedAddressModel>> fetch() async => _read(await _client.get(path));

  @override
  Future<List<SavedAddressModel>> replace(List<SavedAddressModel> addresses) async {
    try {
      final response = await _dio.put<Object?>(
        path,
        data: {'addresses': addresses.map((address) => address.toJson()).toList()},
      );
      return _read(ApiEnvelope.unwrap(response.data));
    } on DioException catch (e) {
      final error = e.error;
      if (error is AppException) throw error;
      throw const ServerException();
    }
  }

  /// `GET` answers `{addresses, savedAt}`, `PUT` the list itself.
  static List<SavedAddressModel> _read(Object? data) {
    final raw = data is Map<String, dynamic> ? data['addresses'] : data;
    if (raw is! List) throw const ServerException();
    final addresses = <SavedAddressModel>[];
    for (final entry in raw) {
      // One unreadable entry is skipped, not allowed to hide the rest.
      try {
        if (entry is Map<String, dynamic>) addresses.add(SavedAddressModel.fromJson(entry));
      } catch (error) {
        debugPrint('Skipped a saved address that could not be read: $error');
      }
    }
    return addresses;
  }
}
