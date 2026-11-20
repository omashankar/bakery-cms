import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/view_status.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../media/domain/photo_source.dart';
import '../../domain/entities/photo_frame_shape.dart';
import '../bloc/cake_photo/cake_photo_cubit.dart';
import '../bloc/cake_photo/cake_photo_state.dart';
import 'photo_print_editor.dart';

/// "Add your photo" on a photo cake: choose a photo, fit it (and a name)
/// into the product's print shape, see the print upload; edit, change or
/// remove it. What is uploaded is the flattened print, as on the website.
class CakePhotoPicker extends StatelessWidget {
  const CakePhotoPicker({super.key, required this.shape});

  /// The outline this product prints inside.
  final PhotoFrameShape shape;

  Future<void> _openEditor(BuildContext context, CakePhotoState state) async {
    final source = state.sourcePath;
    if (source == null) return;
    final cubit = context.read<CakePhotoCubit>();
    final draft = await PhotoPrintEditor.show(
      context,
      sourcePath: source,
      shape: shape,
      draft: state.draft,
    );
    if (draft == null) {
      cubit.closeEditor();
    } else {
      await cubit.use(draft, shape);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<CakePhotoCubit, CakePhotoState>(
      listenWhen: (previous, current) => !previous.editing && current.editing,
      listener: _openEditor,
      child: _card(context),
    );
  }

  Widget _card(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: context.colors.outline, width: AppSpacing.borderWidth),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: BlocBuilder<CakePhotoCubit, CakePhotoState>(
          builder: (context, state) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  _Thumbnail(path: state.localPath, uploading: state.status.isLoading),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: _Status(state: state)),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              _Actions(state: state),
            ],
          ),
        ),
      ),
    );
  }
}

class _Thumbnail extends StatelessWidget {
  const _Thumbnail({required this.path, required this.uploading});

  final String? path;
  final bool uploading;

  /// Decode the picked photo at thumbnail size (3x for dense screens), not
  /// at the 2000px it was saved at.
  static final int _decodeWidth = (AppSpacing.thumbnailSize * 3).round();

  /// How much of the photo shows through while it uploads.
  static const double _scrimOpacity = 0.6;

  @override
  Widget build(BuildContext context) {
    final picked = path;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      child: SizedBox.square(
        dimension: AppSpacing.thumbnailSize,
        child: picked == null
            ? ColoredBox(
                color: context.colors.surfaceContainerHighest,
                child: Icon(Icons.add_a_photo_outlined, color: context.colors.primary),
              )
            : Stack(
                fit: StackFit.expand,
                children: [
                  Image.file(
                    File(picked),
                    fit: BoxFit.cover,
                    cacheWidth: _decodeWidth,
                    errorBuilder: (context, _, _) => ColoredBox(
                      color: context.colors.surfaceContainerHighest,
                      child: Icon(Icons.image_outlined, color: context.colors.onSurfaceVariant),
                    ),
                  ),
                  if (uploading)
                    ColoredBox(
                      color: context.colors.surface.withValues(alpha: _scrimOpacity),
                      child: const Center(
                        child: SizedBox.square(
                          dimension: AppSpacing.loaderSize,
                          child: CircularProgressIndicator(strokeWidth: AppSpacing.loaderStroke),
                        ),
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

class _Status extends StatelessWidget {
  const _Status({required this.state});

  final CakePhotoState state;

  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    final (String line, TextStyle? style) = switch (state.status) {
      ViewStatus.initial => (CatalogStrings.photoHint, muted),
      ViewStatus.loading => (CatalogStrings.photoUploading, muted),
      ViewStatus.success => (
        CatalogStrings.photoUploaded,
        context.text.bodySmall?.copyWith(color: context.colors.primary),
      ),
      ViewStatus.failure => (
        state.errorMessage ?? CatalogStrings.photoFailed,
        context.text.bodySmall?.copyWith(color: context.colors.error),
      ),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(
          TextSpan(
            text: CatalogStrings.photoTitle,
            children: [TextSpan(text: '  ${CatalogStrings.photoRecommended}', style: muted)],
          ),
          style: context.text.titleSmall,
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(line, style: style),
        if (state.status.isFailure) Text(CatalogStrings.photoPendingHint, style: muted),
      ],
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({required this.state});

  final CakePhotoState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<CakePhotoCubit>();
    if (state.status.isLoading) {
      return AppButton.text(label: CatalogStrings.photoRemove, onPressed: cubit.remove);
    }
    if (!state.hasPhoto) {
      return Row(
        children: [
          Expanded(
            child: AppButton.secondary(
              label: CatalogStrings.photoGallery,
              icon: Icons.photo_library_outlined,
              onPressed: () => cubit.pick(PhotoSource.gallery),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: AppButton.secondary(
              label: CatalogStrings.photoCamera,
              icon: Icons.photo_camera_outlined,
              onPressed: () => cubit.pick(PhotoSource.camera),
            ),
          ),
        ],
      );
    }
    // Three buttons with icons do not fit one row on a phone (their words
    // were cut to "C…" and "R…"), so Edit takes its own row above the pair.
    final pair = Row(
      children: [
        Expanded(
          child: state.status.isFailure
              ? AppButton.secondary(
                  label: CatalogStrings.photoRetry,
                  icon: Icons.refresh,
                  onPressed: cubit.retry,
                )
              : AppButton.secondary(
                  label: CatalogStrings.photoChange,
                  icon: Icons.photo_library_outlined,
                  onPressed: () => cubit.pick(PhotoSource.gallery),
                ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: AppButton.secondary(
            label: CatalogStrings.photoRemove,
            icon: Icons.delete_outline,
            onPressed: cubit.remove,
          ),
        ),
      ],
    );
    if (state.sourcePath == null) return pair;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppButton.secondary(
          label: CatalogStrings.photoEdit,
          icon: Icons.crop_rotate,
          onPressed: cubit.edit,
        ),
        const SizedBox(height: AppSpacing.sm),
        pair,
      ],
    );
  }
}
