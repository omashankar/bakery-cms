import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/addresses_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_card.dart';
import '../../domain/entities/saved_address.dart';
import 'saved_address_lines.dart';

/// One saved address, with its default badge and an actions menu.
class SavedAddressCard extends StatelessWidget {
  const SavedAddressCard({
    super.key,
    required this.address,
    required this.onEdit,
    required this.onDelete,
    required this.onMakeDefault,
    this.enabled = true,
  });

  final SavedAddress address;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onMakeDefault;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: enabled ? onEdit : null,
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.xs, AppSpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.xs,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(SavedAddressLines.title(address), style: context.text.titleSmall),
                      if (address.isDefault) const _DefaultBadge(),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  for (final line in SavedAddressLines.body(address))
                    Text(
                      line,
                      style: context.text.bodyMedium
                          ?.copyWith(color: context.colors.onSurfaceVariant),
                    ),
                ],
              ),
            ),
          ),
          PopupMenuButton<_CardAction>(
            enabled: enabled,
            tooltip: AddressesStrings.moreActions,
            onSelected: (action) => switch (action) {
              _CardAction.edit => onEdit(),
              _CardAction.makeDefault => onMakeDefault(),
              _CardAction.delete => onDelete(),
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: _CardAction.edit, child: Text(AddressesStrings.edit)),
              if (!address.isDefault)
                const PopupMenuItem(
                  value: _CardAction.makeDefault,
                  child: Text(AddressesStrings.makeDefault),
                ),
              PopupMenuItem(
                value: _CardAction.delete,
                child: Text(
                  AddressesStrings.delete,
                  style: TextStyle(color: context.colors.error),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

enum _CardAction { edit, makeDefault, delete }

class _DefaultBadge extends StatelessWidget {
  const _DefaultBadge();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.primaryContainer,
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
        child: Text(
          AddressesStrings.defaultBadge,
          style: context.text.labelSmall?.copyWith(color: context.colors.onPrimaryContainer),
        ),
      ),
    );
  }
}
