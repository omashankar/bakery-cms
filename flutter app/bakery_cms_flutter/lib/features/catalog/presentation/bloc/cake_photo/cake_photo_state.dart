import 'package:equatable/equatable.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/photo_print_draft.dart';

/// The photo for a photo cake:
/// initial (none) → loading (printing and uploading) → success (uploaded) |
/// failure.
///
/// The customer's own photo ([sourcePath]) and where they put it in the frame
/// ([draft]) are kept for this visit, so "Edit" reopens the editor as it was
/// left (the website keeps both on the page for the same reason). What goes
/// to the shop is neither: it is the flattened print at [localPath].
///
/// [errorMessage] alongside a non-failure status is a one-off notice (the
/// phone would not open its photos) that leaves the current photo alone.
class CakePhotoState extends Equatable {
  const CakePhotoState({
    this.status = ViewStatus.initial,
    this.localPath,
    this.url,
    this.errorMessage,
    this.sourcePath,
    this.draft = PhotoPrintDraft.empty,
    this.editing = false,
  });

  final ViewStatus status;

  /// The flattened print on this phone: shown as the thumbnail, and the file
  /// that is uploaded.
  final String? localPath;

  /// Where the shop stored it; set only once the upload succeeded.
  final String? url;
  final String? errorMessage;

  /// The photo the customer picked, never sent as it is.
  final String? sourcePath;

  /// Zoom, position, turn and the name, as last set in the editor.
  final PhotoPrintDraft draft;

  /// The editor should be open on [sourcePath].
  final bool editing;

  bool get hasPhoto => localPath != null;

  /// A photo was chosen but the shop does not have it yet. Adding to the cart
  /// now would send the cake without the photo the customer picked.
  bool get isPending => status.isLoading || status.isFailure;

  CakePhotoState copyWith({
    ViewStatus? status,
    String? errorMessage,
    String? sourcePath,
    PhotoPrintDraft? draft,
    bool? editing,
  }) => CakePhotoState(
    status: status ?? this.status,
    localPath: localPath,
    url: url,
    errorMessage: errorMessage,
    sourcePath: sourcePath ?? this.sourcePath,
    draft: draft ?? this.draft,
    editing: editing ?? this.editing,
  );

  @override
  List<Object?> get props => [status, localPath, url, errorMessage, sourcePath, draft, editing];
}
