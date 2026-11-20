import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/questions_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../reviews/presentation/utils/relative_time.dart';
import '../../domain/entities/product_question.dart';
import '../bloc/ask/ask_question_cubit.dart';
import '../bloc/questions/product_questions_cubit.dart';
import '../bloc/questions/product_questions_state.dart';
import 'ask_question_form.dart';

/// "Questions and Answers" on the product page, as the website lays it
/// out: the answered questions ("Q: … A: …, Asked by …"), or an invitation
/// to ask the first; then "Ask a question" opening the form.
///
/// Reads [ProductQuestionsCubit] from above; the page asks it to load once
/// the block is near the screen.
class ProductQuestionsSection extends StatefulWidget {
  const ProductQuestionsSection({super.key, required this.productSlug, required this.productName});

  final String productSlug;
  final String productName;

  /// The line under the heading: how many answered, or the invitation.
  static String summary(int answered) => answered > 0
      ? '$answered ${answered == 1 ? QuestionsStrings.answeredQuestion : QuestionsStrings.answeredQuestions}'
      : QuestionsStrings.askTheShop;

  @override
  State<ProductQuestionsSection> createState() => _ProductQuestionsSectionState();
}

class _ProductQuestionsSectionState extends State<ProductQuestionsSection> {
  bool _formOpen = false;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ProductQuestionsCubit, ProductQuestionsState>(
      builder: (context, state) {
        final muted = context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(ProductQuestionsSection.summary(state.questions.length), style: muted),
            const SizedBox(height: AppSpacing.md),
            if (state.questions.isNotEmpty)
              for (final question in state.questions) ...[
                _QuestionCard(question: question),
                const SizedBox(height: AppSpacing.md),
              ]
            else if (state.status.isFailure)
              Row(
                children: [
                  Expanded(child: Text(QuestionsStrings.loadFailed, style: muted)),
                  AppButton.text(
                    label: QuestionsStrings.retry,
                    onPressed: () => context.read<ProductQuestionsCubit>().load(widget.productSlug),
                  ),
                ],
              )
            else if (state.status.isSuccess) ...[
              Text(QuestionsStrings.beFirst, style: muted),
              const SizedBox(height: AppSpacing.md),
            ],
            OutlinedButton(
              onPressed: () => setState(() => _formOpen = !_formOpen),
              style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft),
              child: const Text(QuestionsStrings.askAQuestion),
            ),
            if (_formOpen) ...[
              const SizedBox(height: AppSpacing.md),
              BlocProvider(
                create: (_) => GetIt.I<AskQuestionCubit>(),
                child: AskQuestionForm(
                  productSlug: widget.productSlug,
                  productName: widget.productName,
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.question});

  final ProductQuestion question;

  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    final answeredAt = question.answeredAt;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${QuestionsStrings.questionPrefix} ${question.question}',
              style: context.text.titleSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${QuestionsStrings.answerPrefix} ${question.answer}',
              style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              [
                '${QuestionsStrings.askedBy} ${question.name}',
                if (answeredAt != null)
                  '${QuestionsStrings.answered} ${RelativeTime.of(answeredAt)}',
              ].join(' · '),
              style: muted,
            ),
          ],
        ),
      ),
    );
  }
}
