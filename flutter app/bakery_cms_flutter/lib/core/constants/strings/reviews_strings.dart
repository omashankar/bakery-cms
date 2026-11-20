/// Copy for the product page's "Ratings and reviews" block and the review
/// form, worded as the website words them (`product-detail-page.tsx`,
/// `product-review-form.tsx`, `rating-summary.tsx`).
abstract final class ReviewsStrings {
  static const String title = 'Ratings and reviews';
  static const String noRatingsYet = 'No ratings yet';
  static const String basedOn = 'based on';
  static const String rating = 'rating';
  static const String ratings = 'ratings';
  static const String loading = 'Loading reviews…';
  static const String empty = 'No published reviews yet. Be the first to share your experience.';
  static const String loadFailed = 'Reviews could not be loaded.';
  static const String retry = 'Try again';
  static const String featured = 'Featured';
  static const String shopResponse = 'Response from the shop';
  static const String verifiedBuyer = 'Verified Buyer';
  static const String helpful = 'Helpful';
  static const String notHelpful = 'Not helpful';
  static const String markedHelpful = 'Marked helpful';
  static const String markedNotHelpful = 'Marked not helpful';
  static const String rateProduct = 'Rate Product';
  static const String ratedOutOf = 'out of 5';

  // When (the website's `formatRelativeTime`)
  static const String justNow = 'Just now';
  static const String minutesAgo = 'm ago';
  static const String hoursAgo = 'h ago';
  static const String daysAgo = 'd ago';

  // Words for a score
  static const String excellent = 'Excellent';
  static const String veryGood = 'Very Good';
  static const String good = 'Good';
  static const String fair = 'Fair';
  static const String poor = 'Poor';

  // The form
  static const String formTitlePrefix = 'Write a review for';
  static const String formModerated = 'Reviews are moderated before appearing on the storefront.';
  static const String formRating = 'Rating';
  static const String star = 'star';
  static const String stars = 'stars';
  static const String formName = 'Your name';
  static const String formEmail = 'Email (optional)';
  static const String formTitle = 'Title (optional)';
  static const String formBody = 'Your review';
  static const String formPhotos = 'Photos (optional)';
  static const String formPhotosHint =
      'A photo of what you received. Shown with your review once it is approved.';
  static const String formPhotosUploading = 'Uploading…';
  static const String formAddPhoto = 'Add photo';
  static const String formRemovePhoto = 'Remove photo';
  static const String formSubmit = 'Submit review';
  static const String formSubmitting = 'Submitting...';
  static const String formMissing = 'Please add your name and review';
  static const String formBadEmail = 'Please enter a valid email';
  static const String formSent = 'Thank you! Your review is pending approval.';
  static const String formNotSent =
      "We couldn't send your review. Please check your connection and try again.";
  static const String formTooManyPhotos = 'Up to 4 photos';
  static const String formPhotosUnavailable =
      'Photos cannot be added just now. You can still post your review without one.';
  static const String formPhotoFailed = 'Could not upload that photo';
  static const String formPhotoPickFailed =
      'Could not open your photos. Please allow access and try again.';
}
