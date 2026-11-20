import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/addresses_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/app_dialog.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/content_width.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../../core/widgets/failure_snackbar_listener.dart';
import '../../../../core/widgets/state_view.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../domain/entities/saved_address.dart';
import '../bloc/address_book_action.dart';
import '../bloc/address_book_cubit.dart';
import '../bloc/address_book_state.dart';
import '../widgets/address_form_sheet.dart';
import '../widgets/saved_address_card.dart';

/// The customer's saved addresses: add, edit, delete, pick the default.
class AddressBookPage extends StatelessWidget {
  const AddressBookPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.I<AddressBookCubit>()..load(forceRefresh: true),
      child: const _AddressBookView(),
    );
  }
}

class _AddressBookView extends StatelessWidget {
  const _AddressBookView();

  void _add(BuildContext context) {
    final state = context.read<AddressBookCubit>().state;
    if (state.book.isFull) {
      AppSnackbar.error(context, AddressesStrings.bookFull);
      return;
    }
    final customer = context.read<AuthBloc>().state.customer;
    AddressFormSheet.show(
      context,
      SavedAddress(
        fullName: customer?.name ?? '',
        email: customer?.email ?? '',
        phone: customer?.phone ?? '',
      ),
    );
  }

  Future<void> _delete(BuildContext context, SavedAddress address) async {
    final cubit = context.read<AddressBookCubit>();
    final confirmed = await AppDialog.confirm(
      context,
      title: AddressesStrings.deleteTitle,
      message: AddressesStrings.deleteMessage,
      confirmLabel: AddressesStrings.delete,
      destructive: true,
    );
    if (confirmed) await cubit.delete(address.id);
  }

  /// Delete and default report here. A save reports inside its sheet, which
  /// would cover a snackbar on this page.
  static void _onActionDone(BuildContext context, AddressBookState state) {
    final action = state.lastAction;
    if (action == null || action == AddressBookAction.save) return;
    if (state.actionStatus.isFailure) {
      AppSnackbar.error(context, state.errorMessage ?? '');
    } else if (state.actionStatus.isSuccess) {
      AppSnackbar.success(
        context,
        action == AddressBookAction.delete
            ? AddressesStrings.deleted
            : AddressesStrings.defaultChanged,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AppAppBar(title: AddressesStrings.title),
      // Only over a list: an empty book already has its own Add button, and
      // two of them on one screen read as two different things.
      floatingActionButton: BlocSelector<AddressBookCubit, AddressBookState, bool>(
        selector: (state) => state.status.isSuccess && !state.book.isEmpty,
        builder: (context, loaded) => loaded
            ? FloatingActionButton.extended(
                onPressed: () => _add(context),
                icon: const Icon(Icons.add),
                label: const Text(AddressesStrings.add),
              )
            : const SizedBox.shrink(),
      ),
      body: BlocListener<AddressBookCubit, AddressBookState>(
        listenWhen: (previous, current) =>
            previous.actionStatus != current.actionStatus && !current.actionStatus.isLoading,
        listener: _onActionDone,
        child: FailureSnackbarListener<AddressBookCubit, AddressBookState>(
          statusOf: (s) => s.status,
          messageOf: (s) => s.errorMessage,
          hasContent: (s) => !s.book.isEmpty,
          child: BlocBuilder<AddressBookCubit, AddressBookState>(
            builder: (context, state) => StateView(
              status: state.status,
              isEmpty: state.book.isEmpty,
              errorMessage: state.errorMessage,
              onRetry: () => context.read<AddressBookCubit>().load(forceRefresh: true),
              empty: EmptyView(
                icon: Icons.location_on_outlined,
                title: AddressesStrings.emptyTitle,
                message: AddressesStrings.emptyMessage,
                actionLabel: AddressesStrings.add,
                onAction: () => _add(context),
              ),
              builder: (_) => RefreshIndicator(
                onRefresh: () => context.read<AddressBookCubit>().load(forceRefresh: true),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.lg,
                    // Clear of the add button.
                    AppSpacing.xxxl + AppSpacing.xxl,
                  ),
                  itemCount: state.addresses.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, index) {
                    final address = state.addresses[index];
                    return ContentWidth(
                      child: SavedAddressCard(
                        address: address,
                        enabled: !state.isBusy,
                        onEdit: () => AddressFormSheet.show(context, address),
                        onDelete: () => _delete(context, address),
                        onMakeDefault: () =>
                            context.read<AddressBookCubit>().makeDefault(address.id),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
