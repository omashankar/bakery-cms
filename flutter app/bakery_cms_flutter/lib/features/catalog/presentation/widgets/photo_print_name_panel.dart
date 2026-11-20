import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../domain/entities/photo_print_draft.dart';
import '../../domain/services/photo_print_layout.dart';
import '../bloc/photo_print_editor/photo_print_editor_cubit.dart';
import 'name_colour_swatches.dart';
import 'photo_print_slider.dart';

/// The Name panel: the name (25 characters at most), bold, italic, colour,
/// size, position and turn, as on the website. What is typed is what is
/// drawn: there is no "Set" button to forget.
class PhotoPrintNamePanel extends StatelessWidget {
  const PhotoPrintNamePanel({super.key, required this.draft});

  final PhotoPrintDraft draft;

  static String charactersLeftLabel(String name) {
    final left = PhotoPrintLayout.charactersLeft(name);
    return '$left ${left == 1 ? CatalogStrings.printCharacterLeft : CatalogStrings.printCharactersLeft}';
  }

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<PhotoPrintEditorCubit>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(
          label: CatalogStrings.printNameLabel,
          hint: CatalogStrings.printNameHint,
          initialValue: draft.name,
          maxLength: PhotoPrintLayout.nameLimit,
          textCapitalization: TextCapitalization.words,
          onChanged: (name) => cubit.update(draft.copyWith(name: name)),
        ),
        Text(
          charactersLeftLabel(draft.name),
          style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.lg,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _Tick(
              label: CatalogStrings.printBold,
              value: draft.bold,
              onChanged: (bold) => cubit.update(draft.copyWith(bold: bold)),
            ),
            _Tick(
              label: CatalogStrings.printItalic,
              value: draft.italic,
              onChanged: (italic) => cubit.update(draft.copyWith(italic: italic)),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(CatalogStrings.printColour, style: context.text.bodySmall),
        const SizedBox(height: AppSpacing.xs),
        NameColourSwatches(
          selected: draft.colour,
          onSelected: (colour) => cubit.update(draft.copyWith(colour: colour)),
        ),
        const SizedBox(height: AppSpacing.sm),
        PhotoPrintSlider(
          label: CatalogStrings.printTextSize,
          value: draft.nameSize,
          range: PhotoPrintLayout.nameSizeRange,
          onChanged: (nameSize) => cubit.update(draft.copyWith(nameSize: nameSize)),
        ),
        PhotoPrintSlider(
          label: CatalogStrings.printUpDown,
          value: draft.nameY,
          range: PhotoPrintLayout.offsetRange,
          onChanged: (nameY) => cubit.update(draft.copyWith(nameY: nameY)),
        ),
        PhotoPrintSlider(
          label: CatalogStrings.printLeftRight,
          value: draft.nameX,
          range: PhotoPrintLayout.offsetRange,
          onChanged: (nameX) => cubit.update(draft.copyWith(nameX: nameX)),
        ),
        PhotoPrintSlider(
          label: CatalogStrings.printRotate,
          value: draft.nameRotation,
          range: PhotoPrintLayout.rotationRange,
          onChanged: (nameRotation) => cubit.update(draft.copyWith(nameRotation: nameRotation)),
        ),
      ],
    );
  }
}

class _Tick extends StatelessWidget {
  const _Tick({required this.label, required this.value, required this.onChanged});

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onChanged(!value),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Checkbox(value: value, onChanged: (checked) => onChanged(checked ?? false)),
          Text(label, style: context.text.bodyMedium),
        ],
      ),
    );
  }
}
