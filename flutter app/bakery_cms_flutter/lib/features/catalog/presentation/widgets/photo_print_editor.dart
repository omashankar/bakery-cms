import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/content_width.dart';
import '../../domain/entities/photo_frame_shape.dart';
import '../../domain/entities/photo_print_draft.dart';
import '../bloc/photo_print_editor/photo_print_editor_cubit.dart';
import '../bloc/photo_print_editor/photo_print_editor_state.dart';
import '../painting/photo_image_decoder.dart';
import 'photo_print_name_panel.dart';
import 'photo_print_photo_panel.dart';
import 'photo_print_preview.dart';

/// "Fit your photo in the frame": the website's photo print editor
/// (`components/storefront/photo-print-editor.tsx`) on a phone. The preview
/// is the print drawn smaller; "Use this photo" hands back where everything
/// was put, and the caller paints and uploads the print from it.
class PhotoPrintEditor extends StatelessWidget {
  const PhotoPrintEditor({super.key, required this.shape});

  final PhotoFrameShape shape;

  /// The most of the screen's height the preview may take, so the controls
  /// under it always have room on a short phone.
  static const double _previewHeightShare = 0.4;

  /// Opens the editor full screen on [sourcePath]. Resolves to the draft to
  /// print, or null when the customer cancelled.
  static Future<PhotoPrintDraft?> show(
    BuildContext context, {
    required String sourcePath,
    required PhotoFrameShape shape,
    required PhotoPrintDraft draft,
  }) {
    final decoder = GetIt.I.isRegistered<PhotoImageDecoder>()
        ? GetIt.I<PhotoImageDecoder>()
        : const PhotoImageDecoder();
    return Navigator.of(context).push<PhotoPrintDraft>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => BlocProvider(
          create: (_) =>
              PhotoPrintEditorCubit(sourcePath: sourcePath, draft: draft, decoder: decoder)..open(),
          child: PhotoPrintEditor(shape: shape),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(CatalogStrings.printEditorTitle)),
      body: BlocBuilder<PhotoPrintEditorCubit, PhotoPrintEditorState>(
        builder: (context, state) {
          final cubit = context.read<PhotoPrintEditorCubit>();
          // THE PREVIEW STAYS IN VIEW: only the controls scroll, so every
          // slider is moved while watching what it does, and Cancel / Use
          // this photo are always on screen (they sat below the fold).
          final previewMax = MediaQuery.sizeOf(context).height * _previewHeightShare;
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.sm,
                ),
                child: ContentWidth(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: ConstrainedBox(
                          constraints: BoxConstraints(maxHeight: previewMax, maxWidth: previewMax),
                          child: PhotoPrintPreview(shape: shape, state: state),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      SegmentedButton<bool>(
                        segments: const [
                          ButtonSegment(value: false, label: Text(CatalogStrings.printTabPhoto)),
                          ButtonSegment(value: true, label: Text(CatalogStrings.printTabName)),
                        ],
                        selected: {state.namePanel},
                        showSelectedIcon: false,
                        onSelectionChanged: (choice) => cubit.showNamePanel(choice.first),
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                  child: ContentWidth(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (state.namePanel)
                          PhotoPrintNamePanel(draft: state.draft)
                        else
                          PhotoPrintPhotoPanel(draft: state.draft),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: AppButton.text(
                            label: CatalogStrings.printStartAgain,
                            icon: Icons.restart_alt,
                            onPressed: cubit.startAgain,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: context.colors.surface,
                  border: Border(top: BorderSide(color: context.colors.outline)),
                ),
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Row(
                      children: [
                        Expanded(
                          child: AppButton.secondary(
                            label: CatalogStrings.printCancel,
                            onPressed: () => Navigator.of(context).pop(),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: AppButton(
                            label: CatalogStrings.printUse,
                            // Disabled until there is a photograph: a name
                            // alone is not a print.
                            onPressed: state.canUse
                                ? () => Navigator.of(context).pop(state.draft)
                                : null,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
