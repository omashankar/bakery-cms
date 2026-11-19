import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/listing_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../bloc/listing_controls/listing_controls_cubit.dart';
import '../bloc/listing_controls/listing_controls_state.dart';
import '../utils/listing_labels.dart';
import 'filter_sheet.dart';
import 'sort_sheet.dart';

/// The bar pinned under a listing: "Sort by · Popularity" on one half and
/// "Filter (2)" on the other. Each opens its sheet.
class ListingBottomBar extends StatelessWidget {
  const ListingBottomBar({super.key, required this.showRatingFilter});

  /// Passed on to [FilterSheet.showRatingFilter].
  final bool showRatingFilter;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ListingControlsCubit, ListingControlsState>(
      builder: (context, state) => DecoratedBox(
        decoration: BoxDecoration(
          color: context.colors.surface,
          border: Border(
            top: BorderSide(color: context.colors.outlineVariant, width: AppSpacing.borderWidth),
          ),
        ),
        child: SafeArea(
          top: false,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: _BarAction(
                    icon: Icons.swap_vert,
                    label:
                        '${ListingStrings.sortBy}${ListingStrings.barSeparator}'
                        '${ListingLabels.sort(state.sort)}',
                    onTap: () => SortSheet.show(context),
                  ),
                ),
                VerticalDivider(
                  width: AppSpacing.borderWidth,
                  thickness: AppSpacing.borderWidth,
                  indent: AppSpacing.sm,
                  endIndent: AppSpacing.sm,
                  color: context.colors.outlineVariant,
                ),
                Expanded(
                  child: _BarAction(
                    icon: Icons.tune,
                    label: ListingStrings.filterCount(state.filter.activeCount),
                    onTap: () => FilterSheet.show(context, showRatingFilter: showRatingFilter),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BarAction extends StatelessWidget {
  const _BarAction({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSpacing.buttonHeight),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: AppSpacing.iconSm + AppSpacing.xxs),
                const SizedBox(width: AppSpacing.sm),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.labelLarge,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
