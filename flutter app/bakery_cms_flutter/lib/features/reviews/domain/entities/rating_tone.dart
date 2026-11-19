/// The colour family of a star score, the way the website paints it
/// (`ratingTone`): three stars and up good, two fair, one poor.
enum RatingTone {
  good,
  fair,
  poor;

  static RatingTone of(int stars) {
    if (stars >= 3) return good;
    if (stars >= 2) return fair;
    return poor;
  }
}
