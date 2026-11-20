import 'package:intl/intl.dart';

import '../../../../core/constants/strings/reviews_strings.dart';

/// "5m ago", "3h ago", "2d ago", then the date: the website's
/// `formatRelativeTime` (`utils/format.ts`).
abstract final class RelativeTime {
  static final DateFormat _date = DateFormat('d MMM yyyy');

  static String of(DateTime date, {DateTime? now}) {
    final diff = (now ?? DateTime.now()).difference(date);
    if (diff.inMinutes < 1) return ReviewsStrings.justNow;
    if (diff.inMinutes < 60) return '${diff.inMinutes}${ReviewsStrings.minutesAgo}';
    if (diff.inHours < 24) return '${diff.inHours}${ReviewsStrings.hoursAgo}';
    if (diff.inDays < 7) return '${diff.inDays}${ReviewsStrings.daysAgo}';
    return _date.format(date.toLocal());
  }
}
