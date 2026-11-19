import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/account_strings.dart';
import '../../../../core/constants/strings/addresses_strings.dart';
import '../../../../core/constants/strings/support_strings.dart';
import '../../../../core/constants/strings/wishlist_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/app_dialog.dart';
import '../../../../core/widgets/app_loader.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/content_width.dart';
import '../../../../core/widgets/page_heading.dart';
import '../../../catalog/presentation/widgets/header_cart_button.dart';
import '../../../catalog/presentation/widgets/header_search_button.dart';
import '../../../catalog/presentation/widgets/shop_title.dart';
import '../../../auth/domain/entities/customer.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../auth/presentation/bloc/auth_event.dart';
import '../../../auth/presentation/bloc/auth_state.dart';
import '../../../support/domain/entities/shop_page.dart';
import '../bloc/delete_account_cubit.dart';
import '../bloc/delete_account_state.dart';
import '../bloc/profile_cubit.dart';
import '../widgets/account_tile.dart';
import '../widgets/account_tile_group.dart';
import '../widgets/customer_card.dart';
import '../widgets/edit_profile_sheet.dart';

class AccountPage extends StatelessWidget {
  const AccountPage({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => GetIt.I<ProfileCubit>()),
        BlocProvider(create: (_) => GetIt.I<DeleteAccountCubit>()),
      ],
      child: const _AccountView(),
    );
  }
}

class _AccountView extends StatelessWidget {
  const _AccountView();

  Future<void> _signOut(BuildContext context) async {
    final authBloc = context.read<AuthBloc>();
    final confirmed = await AppDialog.confirm(
      context,
      title: AccountStrings.signOutTitle,
      message: AccountStrings.signOutMessage,
      confirmLabel: AccountStrings.signOut,
      destructive: true,
    );
    // The router follows AuthBloc and leaves this screen by itself.
    if (confirmed) authBloc.add(const AuthSignOutRequested());
  }

  Future<void> _deleteAccount(BuildContext context) async {
    final cubit = context.read<DeleteAccountCubit>();
    final confirmed = await AppDialog.confirm(
      context,
      title: AccountStrings.deleteAccountTitle,
      message: AccountStrings.deleteAccountMessage,
      confirmLabel: AccountStrings.deleteAccountConfirm,
      destructive: true,
    );
    if (!confirmed || !context.mounted) return;
    // A success signs the customer out, and the router then leaves this
    // screen on its own; these two outlive it.
    final router = GoRouter.of(context);
    final rootContext = Navigator.of(context, rootNavigator: true).context;
    if (!await cubit.delete()) return; // the listener below says why
    router.go(AppRoutes.home);
    if (rootContext.mounted) AppSnackbar.success(rootContext, AccountStrings.accountDeleted);
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<DeleteAccountCubit, DeleteAccountState>(
      listenWhen: (previous, current) => current.status.isFailure,
      listener: (context, state) =>
          AppSnackbar.error(context, state.errorMessage ?? AccountStrings.deleteAccountFailed),
      child: Scaffold(
        // The shop's brand, as on every tab; the page's name is its heading.
        appBar: const AppAppBar(
          titleWidget: ShopTitle(),
          actions: [HeaderSearchButton(), HeaderCartButton()],
        ),
        body: BlocSelector<AuthBloc, AuthState, Customer?>(
          selector: (state) => state.customer,
          builder: (context, customer) {
            if (customer == null) return const AppLoader();
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                ContentWidth(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const PageHeading(AccountStrings.title, padded: false),
                      const SizedBox(height: AppSpacing.md),
                      CustomerCard(customer: customer),
                      const SizedBox(height: AppSpacing.xl),
                      AccountTileGroup(
                        children: [
                          AccountTile(
                            icon: Icons.receipt_long_outlined,
                            title: AccountStrings.myOrders,
                            subtitle: AccountStrings.myOrdersHint,
                            onTap: () => context.go(AppRoutes.orders),
                          ),
                          AccountTile(
                            icon: Icons.favorite_border,
                            title: WishlistStrings.accountTile,
                            subtitle: WishlistStrings.accountTileHint,
                            onTap: () => context.push(AppRoutes.wishlist),
                          ),
                          AccountTile(
                            icon: Icons.location_on_outlined,
                            title: AddressesStrings.accountTile,
                            subtitle: AddressesStrings.accountTileHint,
                            onTap: () => context.go(AppRoutes.addresses),
                          ),
                          AccountTile(
                            icon: Icons.edit_outlined,
                            title: AccountStrings.editProfile,
                            subtitle: AccountStrings.editProfileHint,
                            onTap: () => EditProfileSheet.show(context, customer),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      AccountTileGroup(
                        title: SupportStrings.sectionTitle,
                        children: [
                          AccountTile(
                            icon: Icons.support_agent_outlined,
                            title: SupportStrings.contactTile,
                            subtitle: SupportStrings.contactTileHint,
                            onTap: () => context.push(AppRoutes.contact),
                          ),
                          AccountTile(
                            icon: Icons.help_outline,
                            title: SupportStrings.faqTile,
                            subtitle: SupportStrings.faqTileHint,
                            onTap: () => context.push(AppRoutes.faq),
                          ),
                          AccountTile(
                            icon: Icons.privacy_tip_outlined,
                            title: SupportStrings.privacyTile,
                            onTap: () => context.push(AppRoutes.page(ShopPage.privacySlug)),
                          ),
                          AccountTile(
                            icon: Icons.gavel_outlined,
                            title: SupportStrings.termsTile,
                            onTap: () => context.push(AppRoutes.page(ShopPage.termsSlug)),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      AccountTileGroup(
                        children: [
                          AccountTile(
                            icon: Icons.logout,
                            title: AccountStrings.signOut,
                            destructive: true,
                            onTap: () => _signOut(context),
                          ),
                          BlocSelector<DeleteAccountCubit, DeleteAccountState, bool>(
                            selector: (state) => state.status.isLoading,
                            builder: (context, deleting) => AccountTile(
                              icon: Icons.delete_outline,
                              title: AccountStrings.deleteAccount,
                              subtitle: AccountStrings.deleteAccountHint,
                              destructive: true,
                              onTap: deleting ? null : () => _deleteAccount(context),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
