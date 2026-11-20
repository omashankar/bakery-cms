import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/reviews_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';
import '../../domain/entities/rating_summary.dart';
import '../bloc/review_form/review_form_cubit.dart';
import '../bloc/reviews/reviews_cubit.dart';
import '../bloc/reviews/reviews_state.dart';
import 'rating_summary_view.dart';
import 'review_card.dart';
import 'review_form.dart';

/// "Ratings and reviews" on the product page, as the website lays it out:
/// the summary counted from the reviews below it, the reviews as a row that
/// scrolls sideways, and "Rate Product" opening the form under them.
///
/// Reads [ReviewsCubit] from above; the page asks it to load once the block
/// is near the screen.
class ProductReviewsSection extends StatefulWidget {
  const ProductReviewsSection({
    super.key,
    required this.productSlug,
    required this.productName,
    required this.reviewCount,
  });

  final String productSlug;
  final String productName;

  /// The count the product itself carries, so the block can say "Loading
  /// reviews…" rather than "no reviews" before the list arrives.
  final int reviewCount;

  /// A card's share of the row, as the website's `w-[85%]`.
  static const double cardWidthFactor = 0.85;

  /// And its widest, as `max-w-sm`.
  static const double cardMaxWidth = 384;

  @override
  State<ProductReviewsSection> createState() => _ProductReviewsSectionState();
}

class _ProductReviewsSectionState extends State<ProductReviewsSection> {
  bool _formOpen = false;

  void _toggleForm() => setState(() => _formOpen = !_formOpen);

  void _sent() {
    setState(() => _formOpen = false);
    // A new review is pending, so this normally comes back unchanged; it runs
    // so that anything approved since the page opened appears.
    context.read<ReviewsCubit>().load(widget.productSlug);
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReviewsCubit, ReviewsState>(
      builder: (context, state) {
        final summary = RatingSummary.of(state.reviews);
        final muted = context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (summary != null) ...[
              RatingSummaryView(summary: summary),
              const SizedBox(height: AppSpacing.lg),
            ],
            if (state.reviews.isEmpty)
              _EmptyLine(
                state: state,
                reviewCount: widget.reviewCount,
                style: muted,
                onRetry: () => context.read<ReviewsCubit>().load(widget.productSlug),
              )
            else
              _ReviewRow(state: state),
            const SizedBox(height: AppSpacing.md),
            Align(
              alignment: Alignment.centerLeft,
              child: AppButton.secondary(
                label: ReviewsStrings.rateProduct,
                expand: false,
                onPressed: _toggleForm,
              ),
            ),
            if (_formOpen) ...[
              const SizedBox(height: AppSpacing.md),
              BlocProvider(
                create: (_) => GetIt.I<ReviewFormCubit>(),
                child: ReviewForm(
                  productSlug: widget.productSlug,
                  productName: widget.productName,
                  onSent: _sent,
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

/// What the block says with no reviews to show: still loading (when the
/// product says it has some), could not load, or none yet.
class _EmptyLine extends StatelessWidget {
  const _EmptyLine({
    required this.state,
    required this.reviewCount,
    required this.style,
    required this.onRetry,
  });

  final ReviewsState state;
  final int reviewCount;
  final TextStyle? style;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (state.status.isFailure) {
      return Row(
        children: [
          Expanded(child: Text(ReviewsStrings.loadFailed, style: style)),
          AppButton.text(label: ReviewsStrings.retry, onPressed: onRetry),
        ],
      );
    }
    final waiting = reviewCount > 0 && state.status.isPending;
    return Text(waiting ? ReviewsStrings.loading : ReviewsStrings.empty, style: style);
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({required this.state});

  final ReviewsState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<ReviewsCubit>();
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth * ProductReviewsSection.cardWidthFactor).clamp(
          0.0,
          ProductReviewsSection.cardMaxWidth,
        );
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final (index, review) in state.reviews.indexed) ...[
                  if (index > 0) const SizedBox(width: AppSpacing.md),
                  SizedBox(
                    width: width,
                    child: ReviewCard(
                      review: review,
                      helpfulCount: state.helpfulOf(review),
                      unhelpfulCount: state.unhelpfulOf(review),
                      votedUp: state.votes.helpful.contains(review.id),
                      votedDown: state.votes.unhelpful.contains(review.id),
                      onHelpful: () => cubit.markHelpful(review),
                      onUnhelpful: () => cubit.markUnhelpful(review),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
