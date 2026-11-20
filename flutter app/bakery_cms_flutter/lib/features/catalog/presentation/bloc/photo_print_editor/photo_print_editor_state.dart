import 'dart:ui' as ui;

import 'package:equatable/equatable.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/photo_print_draft.dart';

/// The editor: initial → loading (opening the photo) → success (the photo is
/// decoded and can be fitted) | failure (it would not open, or is too big).
class PhotoPrintEditorState extends Equatable {
  const PhotoPrintEditorState({
    this.status = ViewStatus.initial,
    this.image,
    this.draft = PhotoPrintDraft.empty,
    this.namePanel = false,
    this.errorMessage,
  });

  final ViewStatus status;

  /// The decoded photo, drawn by the preview. Null until it has opened.
  final ui.Image? image;
  final PhotoPrintDraft draft;

  /// Which panel is showing: the name's (true) or the photo's.
  final bool namePanel;
  final String? errorMessage;

  /// "Use this photo" needs a photograph: a name alone is not a print.
  bool get canUse => status.isSuccess && image != null;

  PhotoPrintEditorState copyWith({
    ViewStatus? status,
    ui.Image? image,
    PhotoPrintDraft? draft,
    bool? namePanel,
    String? errorMessage,
  }) => PhotoPrintEditorState(
    status: status ?? this.status,
    image: image ?? this.image,
    draft: draft ?? this.draft,
    namePanel: namePanel ?? this.namePanel,
    errorMessage: errorMessage,
  );

  @override
  List<Object?> get props => [status, image, draft, namePanel, errorMessage];
}
