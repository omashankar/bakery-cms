import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/catalog_strings.dart';
import '../../domain/entities/photo_print_draft.dart';
import '../../domain/services/photo_print_layout.dart';
import '../bloc/photo_print_editor/photo_print_editor_cubit.dart';
import 'photo_print_slider.dart';

/// The Photo panel: zoom, up/down, left/right and turn, as on the website.
class PhotoPrintPhotoPanel extends StatelessWidget {
  const PhotoPrintPhotoPanel({super.key, required this.draft});

  final PhotoPrintDraft draft;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<PhotoPrintEditorCubit>();
    return Column(
      children: [
        PhotoPrintSlider(
          label: CatalogStrings.printZoom,
          value: draft.zoom,
          range: PhotoPrintLayout.zoomRange,
          onChanged: (zoom) => cubit.update(draft.copyWith(zoom: zoom)),
        ),
        PhotoPrintSlider(
          label: CatalogStrings.printUpDown,
          value: draft.offsetY,
          range: PhotoPrintLayout.offsetRange,
          onChanged: (offsetY) => cubit.update(draft.copyWith(offsetY: offsetY)),
        ),
        PhotoPrintSlider(
          label: CatalogStrings.printLeftRight,
          value: draft.offsetX,
          range: PhotoPrintLayout.offsetRange,
          onChanged: (offsetX) => cubit.update(draft.copyWith(offsetX: offsetX)),
        ),
        PhotoPrintSlider(
          label: CatalogStrings.printRotate,
          value: draft.rotation,
          range: PhotoPrintLayout.rotationRange,
          onChanged: (rotation) => cubit.update(draft.copyWith(rotation: rotation)),
        ),
      ],
    );
  }
}
