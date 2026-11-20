import 'package:shared_preferences/shared_preferences.dart';

import 'review_votes_local_data_source.dart';

/// The votes this phone has cast, kept on the phone (the website keeps them
/// in the browser). A convenience for an honest reader, not a control: the
/// shop rate-limits the endpoint itself.
class ReviewVotesLocalDataSourceImpl implements ReviewVotesLocalDataSource {
  const ReviewVotesLocalDataSourceImpl(this._prefs);

  final SharedPreferences _prefs;

  static const String helpfulKey = 'review_helpful_marks';
  static const String unhelpfulKey = 'review_unhelpful_marks';

  /// Enough for years of reading; the oldest are let go first.
  static const int maxRemembered = 500;

  @override
  Set<String> helpful() => {...?_prefs.getStringList(helpfulKey)};

  @override
  Set<String> unhelpful() => {...?_prefs.getStringList(unhelpfulKey)};

  @override
  Future<void> rememberHelpful(String reviewId) => _remember(helpfulKey, reviewId);

  @override
  Future<void> rememberUnhelpful(String reviewId) => _remember(unhelpfulKey, reviewId);

  Future<void> _remember(String key, String reviewId) async {
    final marks = [...?_prefs.getStringList(key)]..remove(reviewId);
    marks.add(reviewId);
    final kept = marks.length > maxRemembered ? marks.sublist(marks.length - maxRemembered) : marks;
    await _prefs.setStringList(key, kept);
  }
}
