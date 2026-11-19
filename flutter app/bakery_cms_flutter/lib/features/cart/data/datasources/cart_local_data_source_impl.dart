import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/constants/storage_keys.dart';
import '../../../../core/error/cache_exception.dart';
import '../models/cart_item_model.dart';
import 'cart_local_data_source.dart';

class CartLocalDataSourceImpl implements CartLocalDataSource {
  const CartLocalDataSourceImpl(this._prefs);

  final SharedPreferences _prefs;

  @override
  Future<List<CartItemModel>> read() async {
    final raw = _prefs.getString(StorageKeys.cart);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) throw const CacheException();
      return decoded
          .whereType<Map<String, dynamic>>()
          .map(CartItemModel.fromJson)
          .where((item) => item.productSlug.isNotEmpty)
          .toList();
    } on FormatException {
      throw const CacheException();
    }
  }

  @override
  Future<void> write(List<CartItemModel> items) async {
    final saved = await _prefs.setString(
      StorageKeys.cart,
      jsonEncode(items.map((item) => item.toJson()).toList()),
    );
    if (!saved) throw const CacheException();
  }
}
