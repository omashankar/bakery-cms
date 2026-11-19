/// How long is left to order for delivery today.
abstract final class SameDayCountdown {
  /// The time from [now] (the shop's own wall clock) to [cutoffTime]
  /// (`HH:mm`) the same day, or null once it has passed or when the time
  /// cannot be read: the band then hides rather than counting into tomorrow.
  static Duration? remaining(String cutoffTime, DateTime now) {
    final parts = cutoffTime.split(':');
    if (parts.length != 2) return null;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null || hour > 23 || minute > 59) return null;
    final cutoff = DateTime(now.year, now.month, now.day, hour, minute);
    final left = cutoff.difference(now);
    return left > Duration.zero ? left : null;
  }
}
