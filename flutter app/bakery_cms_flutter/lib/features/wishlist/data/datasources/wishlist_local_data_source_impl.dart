import 'package:shared_preferences/shared_preferences.dart';

import 'wishlist_local_data_source.dart';

class WishlistLocalDataSourceImpl implements WishlistLocalDataSource {
  const WishlistLocalDataSourceImpl(this._prefs);

  final SharedPreferences _prefs;

  static const String key = 'wishlist_products';

  @override
  List<String> read() => _prefs.getStringList(key) ?? const [];

  @override
  Future<void> write(List<String> slugs) => _prefs.setStringList(key, slugs);
}
