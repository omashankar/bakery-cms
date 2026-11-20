import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/delivery_area_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/delivery_area.dart';
import '../bloc/delivery_area_cubit.dart';
import '../bloc/delivery_area_state.dart';
import '../bloc/delivery_area_status.dart';
import 'pincode_sheet.dart';

/// One line: a location pin, "Deliver to 324002 · Kota" (or "Add delivery
/// pincode" when none is chosen) and whether the shop delivers there. A tap
/// opens [PincodeSheet].
///
/// Reads the app-wide `DeliveryAreaCubit`; no request of its own, so it is
/// safe at the top of any screen.
class DeliveryAreaBar extends StatelessWidget {
  const DeliveryAreaBar({super.key});

  /// Below this width the status goes under the place instead of beside it.
  static const double _sideBySideMinWidth = 310;

  /// The most of the row the status tag may take beside the place.
  static const double _tagMaxShare = 0.4;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<DeliveryAreaCubit, DeliveryAreaState>(
      builder: (context, state) => InkWell(
        onTap: () => PincodeSheet.show(context),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final destination = Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.location_on_outlined,
                    size: AppSpacing.iconSm,
                    color: context.colors.primary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Flexible(child: _Destination(area: state.area)),
                  Icon(
                    Icons.keyboard_arrow_down,
                    size: AppSpacing.iconSm,
                    color: context.colors.onSurfaceVariant,
                  ),
                ],
              );
              // In a narrow box (the product page's delivery strip) the tag
              // goes under the place, so "324002 · Kota" is never cut to "…".
              if (constraints.maxWidth < _sideBySideMinWidth) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    destination,
                    Padding(
                      padding: const EdgeInsets.only(
                        left: AppSpacing.iconSm + AppSpacing.xs,
                        top: AppSpacing.xxs,
                      ),
                      child: _StatusTag(state: state),
                    ),
                  ],
                );
              }
              return Row(
                children: [
                  Expanded(child: destination),
                  const SizedBox(width: AppSpacing.sm),
                  // Its own width, capped, and shrunk past the cap at a large
                  // text size. Not Flexible: that split the row in half and
                  // cut the place to "324002 · K…" on a phone.
                  ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: constraints.maxWidth * _tagMaxShare),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerRight,
                      child: _StatusTag(state: state),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _Destination extends StatelessWidget {
  const _Destination({required this.area});

  final DeliveryArea? area;

  @override
  Widget build(BuildContext context) {
    final chosen = area;
    final style = context.text.bodyMedium;
    if (chosen == null) {
      return Text(
        DeliveryAreaStrings.addPincode,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: style?.copyWith(color: context.colors.primary),
      );
    }
    final place = chosen.city.isEmpty ? '' : '${DeliveryAreaStrings.placeSeparator}${chosen.city}';
    return Text.rich(
      TextSpan(
        children: [
          const TextSpan(text: '${DeliveryAreaStrings.deliverTo} '),
          TextSpan(
            text: '${chosen.pincode}$place',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: style,
    );
  }
}

class _StatusTag extends StatelessWidget {
  const _StatusTag({required this.state});

  final DeliveryAreaState state;

  @override
  Widget build(BuildContext context) {
    final small = context.text.labelSmall;
    return switch (state.status) {
      DeliveryAreaStatus.none => const SizedBox.shrink(),
      DeliveryAreaStatus.checking => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox.square(
            dimension: AppSpacing.iconSm,
            child: CircularProgressIndicator(strokeWidth: AppSpacing.loaderStroke),
          ),
          const SizedBox(width: AppSpacing.xs),
          Text(DeliveryAreaStrings.checking, style: small),
        ],
      ),
      DeliveryAreaStatus.delivers => Text(
        DeliveryAreaStrings.delivers,
        style: small?.copyWith(color: context.colors.tertiary),
      ),
      DeliveryAreaStatus.partly => Text(
        DeliveryAreaStrings.deliversToParts,
        style: small?.copyWith(color: context.colors.onSurfaceVariant),
      ),
      DeliveryAreaStatus.notDelivered => Text(
        DeliveryAreaStrings.notDelivered,
        style: small?.copyWith(color: context.colors.error),
      ),
      DeliveryAreaStatus.failure => TextButton.icon(
        onPressed: () => context.read<DeliveryAreaCubit>().retry(),
        icon: const Icon(Icons.refresh, size: AppSpacing.iconSm),
        label: Text(DeliveryAreaStrings.couldNotCheck, style: small),
      ),
    };
  }
}
