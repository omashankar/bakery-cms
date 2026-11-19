import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/account_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import 'avatar_sheet_choice.dart';

/// Choose from gallery / Take a photo / Remove photo.
class AvatarSourceSheet extends StatelessWidget {
  const AvatarSourceSheet({super.key, required this.canRemove});

  /// Only offered when there is a photo to remove.
  final bool canRemove;

  static Future<AvatarSheetChoice?> show(BuildContext context, {required bool canRemove}) =>
      showModalBottomSheet<AvatarSheetChoice>(
        context: context,
        // Over the tab bar, not under it: the tab's own navigator would
        // leave the bar drawn across the bottom of the sheet.
        useRootNavigator: true,
        showDragHandle: true,
        builder: (_) => AvatarSourceSheet(canRemove: canRemove),
      );

  @override
  Widget build(BuildContext context) {
    void choose(AvatarSheetChoice choice) => Navigator.of(context).pop(choice);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Text(AccountStrings.changePhoto, style: context.text.titleMedium),
            ),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text(AccountStrings.choosePhoto),
              onTap: () => choose(AvatarSheetChoice.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text(AccountStrings.takePhoto),
              onTap: () => choose(AvatarSheetChoice.camera),
            ),
            if (canRemove)
              ListTile(
                leading: Icon(Icons.delete_outline, color: context.colors.error),
                title: Text(
                  AccountStrings.removePhoto,
                  style: TextStyle(color: context.colors.error),
                ),
                onTap: () => choose(AvatarSheetChoice.remove),
              ),
          ],
        ),
      ),
    );
  }
}
