import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/support_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/app_loader.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/content_width.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../../core/widgets/error_view.dart';
import '../bloc/shop_page_cubit.dart';
import '../bloc/shop_page_state.dart';
import '../widgets/page_block_view.dart';

/// A published CMS page by its slug: Privacy Policy, Terms of Service,
/// Shipping… The website's /store/pages/[slug] (standard template).
class ShopPagePage extends StatelessWidget {
  const ShopPagePage({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.I<ShopPageCubit>()..load(slug),
      child: _ShopPageView(slug: slug),
    );
  }
}

class _ShopPageView extends StatelessWidget {
  const _ShopPageView({required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ShopPageCubit, ShopPageState>(
      builder: (context, state) {
        final page = state.page;
        return Scaffold(
          appBar: AppAppBar(title: page?.title ?? ''),
          body: switch (state) {
            ShopPageState(status: final status) when status.isPending => const AppLoader(),
            ShopPageState(notFound: true) => const EmptyView(
              icon: Icons.description_outlined,
              title: SupportStrings.pageNotFoundTitle,
              message: SupportStrings.pageNotFoundMessage,
            ),
            ShopPageState(status: final status) when status.isFailure || page == null => ErrorView(
              message: state.errorMessage ?? '',
              onRetry: () => context.read<ShopPageCubit>().load(slug),
            ),
            _ when page.blocks.isEmpty => const EmptyView(
              icon: Icons.description_outlined,
              title: SupportStrings.pageEmpty,
            ),
            _ => ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                ContentWidth(
                  child: AppCard(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final (index, block) in page.blocks.indexed)
                          PageBlockView(block: block, isFirst: index == 0),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          },
        );
      },
    );
  }
}
