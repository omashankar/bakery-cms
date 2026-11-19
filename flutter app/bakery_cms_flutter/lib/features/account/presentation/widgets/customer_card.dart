import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/account_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../auth/domain/entities/customer.dart';
import '../../../media/domain/photo_source.dart';
import '../bloc/avatar_change.dart';
import '../bloc/avatar_cubit.dart';
import '../bloc/avatar_state.dart';
import 'avatar_sheet_choice.dart';
import 'avatar_source_sheet.dart';

class CustomerCard extends StatelessWidget {
  const CustomerCard({super.key, required this.customer});

  final Customer customer;

  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant);
    return BlocProvider(
      create: (_) => GetIt.I<AvatarCubit>(),
      child: BlocListener<AvatarCubit, AvatarState>(
        listener: (context, state) {
          if (state.status.isFailure && state.errorMessage != null) {
            AppSnackbar.error(context, state.errorMessage!);
          } else if (state.status.isSuccess) {
            AppSnackbar.success(
              context,
              state.change == AvatarChange.removed
                  ? AccountStrings.photoRemoved
                  : AccountStrings.photoUpdated,
            );
          }
        },
        child: AppCard(
          child: Row(
            children: [
              _EditableAvatar(customer: customer),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(customer.displayName, style: context.text.titleMedium),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(customer.email, style: muted),
                    Text(
                      customer.phone.isEmpty ? AccountStrings.noPhone : customer.phone,
                      style: muted,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The avatar with a small camera badge; a tap offers choose / take / remove.
class _EditableAvatar extends StatelessWidget {
  const _EditableAvatar({required this.customer});

  final Customer customer;

  static const double _badgeSize = AppSpacing.iconMd;

  Future<void> _change(BuildContext context) async {
    final cubit = context.read<AvatarCubit>();
    final choice = await AvatarSourceSheet.show(context, canRemove: customer.avatarUrl.isNotEmpty);
    switch (choice) {
      case null:
        return;
      case AvatarSheetChoice.gallery:
        await cubit.pick(PhotoSource.gallery);
      case AvatarSheetChoice.camera:
        await cubit.pick(PhotoSource.camera);
      case AvatarSheetChoice.remove:
        await cubit.remove();
    }
  }

  @override
  Widget build(BuildContext context) {
    final busy = context.select<AvatarCubit, bool>((cubit) => cubit.state.status.isLoading);
    return Semantics(
      button: true,
      label: AccountStrings.changePhoto,
      child: InkResponse(
        onTap: busy ? null : () => _change(context),
        radius: AppSpacing.thumbnailSize / 2,
        child: SizedBox.square(
          dimension: AppSpacing.thumbnailSize,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _Avatar(customer: customer),
              if (busy)
                DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: context.colors.surface.withValues(alpha: _scrimOpacity),
                  ),
                  child: const Center(
                    child: SizedBox.square(
                      dimension: AppSpacing.loaderSize,
                      child: CircularProgressIndicator(strokeWidth: AppSpacing.loaderStroke),
                    ),
                  ),
                ),
              Positioned(
                right: 0,
                bottom: 0,
                child: Container(
                  width: _badgeSize,
                  height: _badgeSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: context.colors.primary,
                    border: Border.all(color: context.colors.surface, width: AppSpacing.xxs),
                  ),
                  child: Icon(
                    Icons.photo_camera_outlined,
                    size: AppSpacing.iconSm - AppSpacing.xxs,
                    color: context.colors.onPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// How much of the photo shows through while it uploads.
  static const double _scrimOpacity = 0.6;
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.customer});

  final Customer customer;

  @override
  Widget build(BuildContext context) {
    const size = AppSpacing.thumbnailSize;
    if (customer.avatarUrl.isNotEmpty) {
      return AppNetworkImage(url: customer.avatarUrl, borderRadius: AppSpacing.radiusPill);
    }
    final initial = customer.displayName.characters.firstOrNull?.toUpperCase();
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: context.colors.surfaceContainerHighest,
      child: initial == null
          ? Icon(Icons.person_outline, color: context.colors.primary)
          : Text(initial, style: context.text.titleLarge?.copyWith(color: context.colors.primary)),
    );
  }
}
