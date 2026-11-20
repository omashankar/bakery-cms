import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/reviews_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../media/domain/photo_source.dart';
import '../../domain/entities/review_draft.dart';
import '../bloc/review_form/review_form_cubit.dart';
import '../bloc/review_form/review_form_state.dart';

/// "Write a review for …": the website's review form, field for field.
/// [onSent] runs once the shop has it (pending approval).
class ReviewForm extends StatelessWidget {
  const ReviewForm({
    super.key,
    required this.productSlug,
    required this.productName,
    required this.onSent,
  });

  final String productSlug;
  final String productName;
  final VoidCallback onSent;

  static String starsLabel(int value) =>
      '$value ${value == 1 ? ReviewsStrings.star : ReviewsStrings.stars}';

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ReviewFormCubit, ReviewFormState>(
      listenWhen: (previous, current) =>
          current.notice != null && current.notice != previous.notice ||
          current.status != previous.status,
      listener: (context, state) {
        final notice = state.notice;
        if (notice != null) AppSnackbar.error(context, notice);
        if (state.status.isSuccess) {
          AppSnackbar.success(context, ReviewsStrings.formSent);
          onSent();
        }
      },
      builder: (context, state) {
        final cubit = context.read<ReviewFormCubit>();
        final muted = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
        final error = state.status.isFailure ? state.errorMessage : null;
        return DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(color: context.colors.outline, width: AppSpacing.borderWidth),
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '${ReviewsStrings.formTitlePrefix} $productName',
                  style: context.text.titleSmall,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(ReviewsStrings.formModerated, style: muted),
                const SizedBox(height: AppSpacing.lg),
                DropdownButtonFormField<int>(
                  initialValue: state.rating,
                  decoration: const InputDecoration(labelText: ReviewsStrings.formRating),
                  items: [
                    for (var value = ReviewDraft.maxRating; value >= ReviewDraft.minRating; value--)
                      DropdownMenuItem(value: value, child: Text(starsLabel(value))),
                  ],
                  onChanged: state.busy
                      ? null
                      : (value) {
                          if (value != null) cubit.ratingChanged(value);
                        },
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  label: ReviewsStrings.formName,
                  initialValue: state.authorName,
                  enabled: !state.busy,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  onChanged: cubit.nameChanged,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  label: ReviewsStrings.formEmail,
                  initialValue: state.authorEmail,
                  enabled: !state.busy,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  onChanged: cubit.emailChanged,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  label: ReviewsStrings.formTitle,
                  initialValue: state.title,
                  enabled: !state.busy,
                  textCapitalization: TextCapitalization.sentences,
                  onChanged: cubit.titleChanged,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  label: ReviewsStrings.formBody,
                  initialValue: state.body,
                  enabled: !state.busy,
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                  onChanged: cubit.bodyChanged,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(ReviewsStrings.formPhotos, style: context.text.labelLarge),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    for (final url in state.photoUrls) _PhotoTile(url: url),
                    if (state.canAddPhoto)
                      AppButton.secondary(
                        label: ReviewsStrings.formAddPhoto,
                        icon: Icons.add_a_photo_outlined,
                        expand: false,
                        isLoading: state.uploading,
                        onPressed: state.busy ? null : () => cubit.addPhoto(PhotoSource.gallery),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  state.uploading
                      ? ReviewsStrings.formPhotosUploading
                      : ReviewsStrings.formPhotosHint,
                  style: muted,
                ),
                if (error != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(error, style: context.text.bodySmall?.copyWith(color: context.colors.error)),
                ],
                const SizedBox(height: AppSpacing.lg),
                AppButton(
                  label: state.status.isLoading
                      ? ReviewsStrings.formSubmitting
                      : ReviewsStrings.formSubmit,
                  isLoading: state.status.isLoading,
                  onPressed: state.uploading
                      ? null
                      : () => cubit.submit(productSlug: productSlug, productName: productName),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _PhotoTile extends StatelessWidget {
  const _PhotoTile({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: AppSpacing.thumbnailSize,
      child: Stack(
        fit: StackFit.expand,
        children: [
          AppNetworkImage(url: url),
          Align(
            alignment: Alignment.topRight,
            child: IconButton.filledTonal(
              tooltip: ReviewsStrings.formRemovePhoto,
              visualDensity: VisualDensity.compact,
              iconSize: AppSpacing.iconSm,
              icon: const Icon(Icons.close),
              onPressed: () => context.read<ReviewFormCubit>().removePhoto(url),
            ),
          ),
        ],
      ),
    );
  }
}
