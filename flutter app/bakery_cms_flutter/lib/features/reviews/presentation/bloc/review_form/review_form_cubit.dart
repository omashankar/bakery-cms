import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/constants/strings/reviews_strings.dart';
import '../../../../../core/error/server_failure.dart';
import '../../../../../core/utils/validators.dart';
import '../../../../../core/utils/view_status.dart';
import '../../../../catalog/domain/usecases/upload_cake_photo.dart';
import '../../../../media/domain/photo_picker.dart';
import '../../../../media/domain/photo_source.dart';
import '../../../domain/entities/review_draft.dart';
import '../../../domain/usecases/submit_review.dart';
import 'review_form_state.dart';

/// The website's review form (`product-review-form.tsx`): name and review
/// required, email optional (but a real one if given), title optional, up
/// to four photos uploaded as they are chosen. No sign-in: reviews are
/// anonymous and the shop approves each one.
class ReviewFormCubit extends Cubit<ReviewFormState> {
  ReviewFormCubit(this._submit, this._picker, this._upload) : super(const ReviewFormState());

  final SubmitReview _submit;
  final PhotoPicker _picker;

  /// The photo-cake upload: the website sends review photos to the same
  /// endpoint, so the server's ledger knows each URL is the shop's own.
  final UploadCakePhoto _upload;

  /// The status the server answers when photo storage is not set up.
  static const int _uploadsOff = 503;

  void nameChanged(String value) => emit(state.copyWith(authorName: value, status: _editing));
  void emailChanged(String value) => emit(state.copyWith(authorEmail: value, status: _editing));
  void ratingChanged(int value) => emit(
    state.copyWith(
      rating: value.clamp(ReviewDraft.minRating, ReviewDraft.maxRating),
      status: _editing,
    ),
  );
  void titleChanged(String value) => emit(state.copyWith(title: value, status: _editing));
  void bodyChanged(String value) => emit(state.copyWith(body: value, status: _editing));

  /// Typing after a failed send goes back to filling in.
  ViewStatus get _editing => state.status.isFailure ? ViewStatus.initial : state.status;

  Future<void> addPhoto(PhotoSource source) async {
    if (state.busy) return;
    if (!state.canAddPhoto) {
      emit(state.copyWith(notice: ReviewsStrings.formTooManyPhotos));
      return;
    }
    final String? path;
    try {
      path = await _picker.pick(source);
    } catch (error) {
      debugPrint('Photo picker failed: $error');
      if (!isClosed) emit(state.copyWith(notice: ReviewsStrings.formPhotoPickFailed));
      return;
    }
    if (path == null || isClosed) return;
    emit(state.copyWith(uploading: true));
    final result = await _upload(path);
    if (isClosed) return;
    result.match(
      (failure) => emit(
        state.copyWith(
          uploading: false,
          // The endpoint is shared with the photo cake, whose 503 advice
          // ("the store will contact you") is wrong here.
          notice: failure is ServerFailure && failure.statusCode == _uploadsOff
              ? ReviewsStrings.formPhotosUnavailable
              : failure.message,
        ),
      ),
      (url) => emit(state.copyWith(uploading: false, photoUrls: [...state.photoUrls, url])),
    );
  }

  void removePhoto(String url) =>
      emit(state.copyWith(photoUrls: [...state.photoUrls]..remove(url)));

  /// Sends the review for [productSlug]. On failure the form is kept — it is
  /// the customer's only copy of what they wrote.
  Future<void> submit({required String productSlug, required String productName}) async {
    if (state.busy) return;
    if (state.authorName.trim().isEmpty || state.body.trim().isEmpty) {
      emit(state.copyWith(status: ViewStatus.failure, errorMessage: ReviewsStrings.formMissing));
      return;
    }
    final email = state.authorEmail.trim();
    if (email.isNotEmpty && Validators.email(email) != null) {
      emit(state.copyWith(status: ViewStatus.failure, errorMessage: ReviewsStrings.formBadEmail));
      return;
    }
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _submit(
      ReviewDraft(
        productSlug: productSlug,
        productName: productName,
        authorName: state.authorName,
        authorEmail: email,
        rating: state.rating,
        title: state.title,
        body: state.body,
        photoUrls: state.photoUrls,
      ),
    );
    if (isClosed) return;
    result.match(
      (failure) => emit(
        state.copyWith(
          status: ViewStatus.failure,
          errorMessage: failure is ServerFailure && failure.statusCode != null
              ? failure.message
              : ReviewsStrings.formNotSent,
        ),
      ),
      (_) => emit(const ReviewFormState(status: ViewStatus.success)),
    );
  }
}
