/// Tolerant readers for `@JsonKey(fromJson: ...)`.
///
/// The shop's documents grew over time, so an older product can lack a field
/// a newer one has, and a number can arrive as `1` or `1.0`. These keep one
/// odd record from failing a whole list.
abstract final class JsonReaders {
  static double toDouble(Object? value) => switch (value) {
    final num n => n.toDouble(),
    final String s => double.tryParse(s) ?? 0,
    _ => 0,
  };

  static double? toDoubleOrNull(Object? value) => value == null ? null : toDouble(value);

  static int toInt(Object? value) => switch (value) {
    final num n => n.toInt(),
    final String s => int.tryParse(s) ?? 0,
    _ => 0,
  };

  static String string(Object? value) => value is String ? value : '';

  static List<String> strings(Object? value) =>
      value is List ? value.whereType<String>().toList() : const [];

  static bool boolOr(Object? value, {bool fallback = false}) => value is bool ? value : fallback;

  static bool boolTrue(Object? value) => boolOr(value, fallback: true);

  static Map<String, String> stringMap(Object? value) => value is Map
      ? {
          for (final entry in value.entries)
            if (entry.key is String && entry.value is String)
              entry.key as String: entry.value as String,
        }
      : const {};
}
