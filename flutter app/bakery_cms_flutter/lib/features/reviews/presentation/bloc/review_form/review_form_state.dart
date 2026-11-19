import 'package:equatable/equatable.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/review_draft.dart';

/// The "Rate Product" form: initial (being filled in) → loading (sending)
/// → success (sent; pending approval) | failure (not sent, form kept).
///
/// [notice] is a one-off message (a refused photo) that leaves the form as
/// it is.
class ReviewFormState extends Equatable {
  const ReviewFormState({
    this.status = ViewStatus.initial,
    this.authorName = '',
    this.authorEmail = '',
    this.rating = ReviewDraft.maxRating,
    this.title = '',
    this.body = '',
    this.photoUrls = const [],
    this.uploading = false,
    this.errorMessage,
    this.notice,
  });

  final ViewStatus status;
  final String authorName;
  final String authorEmail;

  /// Starts at five, as on the website.
  final int rating;
  final String title;
  final String body;
  final List<String> photoUrls;

  /// A photo is on its way to the shop.
  final bool uploading;
  final String? errorMessage;
  final String? notice;

  bool get canAddPhoto => photoUrls.length < ReviewDraft.maxPhotos;
  bool get busy => status.isLoading || uploading;

  ReviewFormState copyWith({
    ViewStatus? status,
    String? authorName,
    String? authorEmail,
    int? rating,
    String? title,
    String? body,
    List<String>? photoUrls,
    bool? uploading,
    String? errorMessage,
    String? notice,
  }) => ReviewFormState(
    status: status ?? this.status,
    authorName: authorName ?? this.authorName,
    authorEmail: authorEmail ?? this.authorEmail,
    rating: rating ?? this.rating,
    title: title ?? this.title,
    body: body ?? this.body,
    photoUrls: photoUrls ?? this.photoUrls,
    uploading: uploading ?? this.uploading,
    errorMessage: errorMessage,
    notice: notice,
  );

  @override
  List<Object?> get props => [
    status,
    authorName,
    authorEmail,
    rating,
    title,
    body,
    photoUrls,
    uploading,
    errorMessage,
    notice,
  ];
}
