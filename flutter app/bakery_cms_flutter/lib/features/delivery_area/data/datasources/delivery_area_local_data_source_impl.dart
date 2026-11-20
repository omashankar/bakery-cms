import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/constants/storage_keys.dart';
import '../../../../core/error/cache_exception.dart';
import '../models/delivery_area_model.dart';
import 'delivery_area_local_data_source.dart';

class DeliveryAreaLocalDataSourceImpl implements DeliveryAreaLocalDataSource {
  const DeliveryAreaLocalDataSourceImpl(this._prefs);

  final SharedPreferences _prefs;

  @override
  Future<DeliveryAreaModel?> read() async {
    final raw = _prefs.getString(StorageKeys.deliveryArea);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) throw const CacheException();
      final model = DeliveryAreaModel.fromJson(decoded);
      return model.pincode.trim().isEmpty ? null : model;
    } on FormatException {
      throw const CacheException();
    }
  }

  @override
  Future<void> write(DeliveryAreaModel area) async {
    final saved = await _prefs.setString(StorageKeys.deliveryArea, jsonEncode(area.toJson()));
    if (!saved) throw const CacheException();
  }
}
