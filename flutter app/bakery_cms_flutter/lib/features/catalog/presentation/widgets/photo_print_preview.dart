import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/photo_frame_shape.dart';
import '../bloc/photo_print_editor/photo_print_editor_state.dart';
import '../painting/photo_frame_guide.dart';
import '../painting/photo_print_preview_painter.dart';

/// The frame at the print's own proportions, with what will be printed in it.
class PhotoPrintPreview extends StatelessWidget {
  const PhotoPrintPreview({super.key, required this.shape, required this.state});

  /// The cut line's and the empty shape's strength (the website's
  /// `rgba(0,0,0,0.28)` and `rgba(0,0,0,0.07)`), over the theme's ink.
  static const double guideLineAlpha = 0.28;
  static const double guideFillAlpha = 0.07;

  final PhotoFrameShape shape;
  final PhotoPrintEditorState state;

  @override
  Widget build(BuildContext context) {
    final ink = context.colors.onSurface;
    return Semantics(
      image: true,
      label: CatalogStrings.printPreviewLabel,
      child: AspectRatio(
        aspectRatio: shape.ratio,
        child: Stack(
          fit: StackFit.expand,
          children: [
            CustomPaint(
              painter: PhotoPrintPreviewPainter(
                shape: shape,
                image: state.image,
                draft: state.draft,
                guide: PhotoFrameGuide(
                  line: ink.withValues(alpha: guideLineAlpha),
                  fill: ink.withValues(alpha: guideFillAlpha),
                ),
              ),
            ),
            if (state.status.isPending)
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox.square(
                      dimension: AppSpacing.loaderSize,
                      child: CircularProgressIndicator(strokeWidth: AppSpacing.loaderStroke),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      CatalogStrings.printOpening,
                      style: context.text.bodySmall?.copyWith(
                        color: context.colors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            if (state.status.isFailure)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Text(
                    state.errorMessage ?? CatalogStrings.printOpenFailed,
                    textAlign: TextAlign.center,
                    style: context.text.bodyMedium?.copyWith(color: context.colors.error),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
