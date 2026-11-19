import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/questions_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../bloc/ask/ask_question_cubit.dart';
import '../bloc/ask/ask_question_state.dart';

/// "Ask about this — the shop replies by email": name, email and the
/// question. Filed as a product enquiry; public only once answered.
class AskQuestionForm extends StatelessWidget {
  const AskQuestionForm({super.key, required this.productSlug, required this.productName});

  final String productSlug;
  final String productName;

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AskQuestionCubit, AskQuestionState>(
      listenWhen: (previous, current) => current.sent > previous.sent,
      listener: (context, _) => AppSnackbar.success(context, QuestionsStrings.formSent),
      builder: (context, state) {
        final cubit = context.read<AskQuestionCubit>();
        final sending = state.status.isLoading;
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
                Text(QuestionsStrings.formTitle, style: context.text.titleSmall),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  label: QuestionsStrings.formName,
                  initialValue: state.name,
                  enabled: !sending,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  onChanged: cubit.nameChanged,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  label: QuestionsStrings.formEmail,
                  initialValue: state.email,
                  enabled: !sending,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  onChanged: cubit.emailChanged,
                ),
                const SizedBox(height: AppSpacing.md),
                // Keyed on the sends, so a sent question clears the box.
                AppTextField(
                  key: ValueKey(state.sent),
                  label: QuestionsStrings.formQuestion,
                  initialValue: state.question,
                  enabled: !sending,
                  maxLines: 3,
                  textCapitalization: TextCapitalization.sentences,
                  onChanged: cubit.questionChanged,
                ),
                if (error != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(error, style: context.text.bodySmall?.copyWith(color: context.colors.error)),
                ],
                const SizedBox(height: AppSpacing.lg),
                AppButton.secondary(
                  label: sending ? QuestionsStrings.formSending : QuestionsStrings.formSend,
                  isLoading: sending,
                  onPressed: () => cubit.submit(productSlug: productSlug, productName: productName),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
