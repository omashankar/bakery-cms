import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/listing_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/listing_sort.dart';
import '../bloc/listing_controls/listing_controls_cubit.dart';
import '../utils/listing_labels.dart';

/// "Sort by": one tap picks an order and closes the sheet.
///
/// Open it with [SortSheet.show]; it needs a [ListingControlsCubit] above
/// the context it is opened from.
class SortSheet extends StatelessWidget {
  const SortSheet({super.key});

  /// Over the whole app, not under a tab bar.
  static Future<void> show(BuildContext context) {
    final controls = context.read<ListingControlsCubit>();
    return showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      showDragHandle: true,
      builder: (_) => BlocProvider.value(value: controls, child: const SortSheet()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final current = context.select<ListingControlsCubit, ListingSort>((c) => c.state.sort);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.md),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: Text(ListingStrings.sortTitle, style: context.text.titleMedium),
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final sort in ListingSort.values)
                ListTile(
                  title: Text(ListingLabels.sort(sort)),
                  selected: sort == current,
                  trailing: sort == current
                      ? Icon(Icons.check, color: context.colors.primary)
                      : null,
                  onTap: () {
                    context.read<ListingControlsCubit>().sortBy(sort);
                    Navigator.of(context).pop();
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}
