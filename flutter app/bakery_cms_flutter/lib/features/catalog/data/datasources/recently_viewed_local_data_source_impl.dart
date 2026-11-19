import 'package:shared_preferences/shared_preferences.dart';

import 'recently_viewed_local_data_source.dart';

class RecentlyViewedLocalDataSourceImpl implements RecentlyViewedLocalDataSource {
  const RecentlyViewedLocalDataSourceImpl(this._prefs);

  final SharedPreferences _prefs;

  static const String _key = 'recently_viewed_products';

  @override
  List<String> read() => _prefs.getStringList(_key) ?? const [];

  @override
  Future<void> write(List<String> slugs) => _prefs.setStringList(_key, slugs);
}
