import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/support_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/content_width.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../bloc/contact_details_cubit.dart';
import '../bloc/contact_form_cubit.dart';
import '../bloc/contact_form_state.dart';
import '../widgets/contact_details_section.dart';
import '../widgets/contact_form.dart';
import '../widgets/contact_sent_view.dart';

/// The website's /store/contact: the form, then how else to reach the shop.
/// Open to everyone, signed in or not.
class ContactPage extends StatelessWidget {
  const ContactPage({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => GetIt.I<ContactDetailsCubit>()..load()),
        BlocProvider(create: (_) => GetIt.I<ContactFormCubit>()),
      ],
      child: const _ContactView(),
    );
  }
}

class _ContactView extends StatelessWidget {
  const _ContactView();

  @override
  Widget build(BuildContext context) {
    final customer = context.select((AuthBloc bloc) => bloc.state.customer);
    return Scaffold(
      appBar: const AppAppBar(title: SupportStrings.contactTitle),
      body: BlocConsumer<ContactFormCubit, ContactFormState>(
        listenWhen: (previous, current) => !previous.status.isFailure && current.status.isFailure,
        listener: (context, state) =>
            AppSnackbar.error(context, state.errorMessage ?? SupportStrings.sendFailed),
        buildWhen: (previous, current) => previous.status.isSuccess != current.status.isSuccess,
        builder: (context, state) {
          if (state.status.isSuccess) return const ContactSentView();
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              ContentWidth(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(SupportStrings.formTitle, style: context.text.titleMedium),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            SupportStrings.formIntro,
                            style: context.text.bodyMedium?.copyWith(
                              color: context.colors.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          ContactForm(
                            initialName: customer?.name ?? '',
                            initialEmail: customer?.email ?? '',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const ContactDetailsSection(),
                    const SizedBox(height: AppSpacing.md),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.help_outline),
                      title: const Text(SupportStrings.faqTile),
                      subtitle: const Text(SupportStrings.faqTileHint),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push(AppRoutes.faq),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
