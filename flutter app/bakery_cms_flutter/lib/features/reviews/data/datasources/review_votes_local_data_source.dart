abstract interface class ReviewVotesLocalDataSource {
  Set<String> helpful();
  Set<String> unhelpful();
  Future<void> rememberHelpful(String reviewId);
  Future<void> rememberUnhelpful(String reviewId);
}
