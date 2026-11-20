import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/support_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/choice_chips.dart';
import '../../../../core/widgets/content_width.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../../core/widgets/state_view.dart';
import '../../domain/entities/faq_category.dart';
import '../bloc/faq_cubit.dart';
import '../bloc/faq_state.dart';
import '../widgets/faq_accordion.dart';
import '../widgets/faq_category_label.dart';
import '../widgets/faq_help_card.dart';

/// The website's /store/faq: a search, the category pills, the questions,
/// and "Still have questions?".
class FaqPage extends StatelessWidget {
  const FaqPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(create: (_) => GetIt.I<FaqCubit>()..load(), child: const _FaqView());
  }
}

class _FaqView extends StatelessWidget {
  const _FaqView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AppAppBar(title: SupportStrings.faqTitle),
      body: BlocBuilder<FaqCubit, FaqState>(
        builder: (context, state) => StateView(
          status: state.status,
          isEmpty: state.faqs.isEmpty,
          errorMessage: state.errorMessage,
          onRetry: () => context.read<FaqCubit>().load(),
          empty: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              const EmptyView(icon: Icons.help_outline, title: SupportStrings.faqEmpty),
              ContentWidth(child: FaqHelpCard(contact: state.contact)),
            ],
          ),
          builder: (context) => _FaqList(state: state),
        ),
      ),
    );
  }
}

class _FaqList extends StatelessWidget {
  const _FaqList({required this.state});

  final FaqState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<FaqCubit>();
    final visible = state.visible;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        ContentWidth(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                key: const ValueKey('faq-search'),
                onChanged: cubit.search,
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(
                  hintText: SupportStrings.faqSearchHint,
                  prefixIcon: Icon(Icons.search),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              ChoiceChips<FaqCategory>(
                options: FaqCategory.values,
                selected: state.category,
                labelOf: (category) => category.label,
                onSelected: cubit.selectCategory,
              ),
              const SizedBox(height: AppSpacing.lg),
              if (visible.isEmpty)
                const EmptyView(icon: Icons.help_outline, title: SupportStrings.faqNoMatch)
              else
                FaqAccordion(
                  // A new list opens its own top match.
                  key: ValueKey('faqs-${state.category.name}-${visible.first.id}'),
                  faqs: visible,
                ),
              if (state.category != FaqCategory.all) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  SupportStrings.faqShowing(state.category.label),
                  style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              FaqHelpCard(contact: state.contact),
            ],
          ),
        ),
      ],
    );
  }
}
