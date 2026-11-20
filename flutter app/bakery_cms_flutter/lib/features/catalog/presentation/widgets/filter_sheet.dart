import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/listing_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../store/presentation/widgets/shop_currency.dart';
import '../../domain/entities/listing_filter.dart';
import '../../domain/entities/price_band.dart';
import '../bloc/listing_controls/filter_draft_cubit.dart';
import '../bloc/listing_controls/listing_controls_cubit.dart';
import '../utils/listing_labels.dart';

/// "Filter": price ranges, in stock only and, when anything here has been
/// reviewed, 4★ & above. The ticks are a draft until Apply; Clear drops every
/// filter at once.
///
/// Open it with [FilterSheet.show]; it needs a [ListingControlsCubit] above
/// the context it is opened from.
class FilterSheet extends StatelessWidget {
  const FilterSheet({super.key, required this.showRatingFilter});

  /// Only offered when some product in the listing has a review: with none,
  /// the tick could only empty the page.
  final bool showRatingFilter;

  /// Over the whole app, not under a tab bar.
  static Future<void> show(BuildContext context, {required bool showRatingFilter}) {
    final controls = context.read<ListingControlsCubit>();
    return showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => MultiBlocProvider(
        providers: [
          BlocProvider.value(value: controls),
          BlocProvider(create: (_) => FilterDraftCubit(controls.state.filter)),
        ],
        child: FilterSheet(showRatingFilter: showRatingFilter),
      ),
    );
  }

  void _apply(BuildContext context) {
    // The ticks as they are now, not as they were when the button was built.
    final draft = context.read<FilterDraftCubit>().state;
    // A rating tick left from an earlier listing must not hide everything
    // here, where it is not even offered.
    final filter = showRatingFilter ? draft : draft.copyWith(fourStarAndAbove: false);
    context.read<ListingControlsCubit>().applyFilter(filter);
    Navigator.of(context).pop();
  }

  void _clear(BuildContext context) {
    context.read<ListingControlsCubit>().clearFilters();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final currency = context.shopCurrency;
    final heading = context.text.titleSmall;
    return BlocBuilder<FilterDraftCubit, ListingFilter>(
      builder: (context, draft) {
        final draftCubit = context.read<FilterDraftCubit>();
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: Text(ListingStrings.filterTitle, style: context.text.titleMedium),
              ),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Heading(text: ListingStrings.priceHeading, style: heading),
                      for (final band in PriceBand.values)
                        CheckboxListTile(
                          title: Text(ListingLabels.priceBand(band, currency)),
                          value: draft.priceBands.contains(band),
                          onChanged: (_) => draftCubit.toggleBand(band),
                        ),
                      _Heading(text: ListingStrings.availabilityHeading, style: heading),
                      CheckboxListTile(
                        title: const Text(ListingStrings.inStockOnly),
                        value: draft.inStockOnly,
                        onChanged: (_) => draftCubit.toggleInStock(),
                      ),
                      if (showRatingFilter) ...[
                        _Heading(text: ListingStrings.ratingHeading, style: heading),
                        CheckboxListTile(
                          title: const Text(ListingStrings.fourStarAndAbove),
                          value: draft.fourStarAndAbove,
                          onChanged: (_) => draftCubit.toggleFourStars(),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Row(
                  children: [
                    Expanded(
                      child: AppButton.secondary(
                        label: ListingStrings.clear,
                        onPressed: () => _clear(context),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: AppButton(
                        label: ListingStrings.apply,
                        onPressed: () => _apply(context),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading({required this.text, required this.style});

  final String text;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, 0),
      child: Text(text, style: style),
    );
  }
}
