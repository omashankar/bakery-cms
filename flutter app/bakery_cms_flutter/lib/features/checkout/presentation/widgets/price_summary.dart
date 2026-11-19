import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/view_status.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_loader.dart';
import '../../../../core/widgets/form_section.dart';
import '../../domain/entities/quote.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import 'field_caption.dart';
import 'price_breakdown.dart';

/// The running total, priced by the shop. Its four states: first load,
/// priced, failed with nothing to show, and failed on top of an older price.
class PriceSummary extends StatelessWidget {
  const PriceSummary({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocSelector<CheckoutBloc, CheckoutState, (ViewStatus, Quote?, String?, String)>(
      selector: (state) => (state.estimateStatus, state.quote, state.estimateError, state.currency),
      builder: (context, summary) {
        final (status, quote, error, currency) = summary;
        void retry() => context.read<CheckoutBloc>().add(const CheckoutEstimateRequested());

        return FormSection(
          title: CheckoutStrings.sectionSummary,
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (status.isLoading) ...[
                    const LinearProgressIndicator(),
                    const SizedBox(height: AppSpacing.sm),
                    const FieldCaption(CheckoutStrings.calculating, muted: true),
                  ],
                  if (quote == null && status.isPending) const AppLoader(),
                  if (quote != null) PriceBreakdown(totals: quote.totals, currency: currency),
                  if (status.isFailure) ...[
                    const SizedBox(height: AppSpacing.sm),
                    FieldCaption(error ?? CheckoutStrings.estimateFailed, isError: true),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: AppButton.text(label: AppStrings.retry, onPressed: retry),
                    ),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
