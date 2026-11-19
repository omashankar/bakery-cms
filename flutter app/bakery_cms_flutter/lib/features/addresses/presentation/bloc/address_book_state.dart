import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/address_book.dart';
import '../../domain/entities/saved_address.dart';
import 'address_book_action.dart';

/// The address book screen.
///
/// [status] is the book itself: initial → loading → success | failure.
/// [actionStatus] is the change in flight (save, delete, default), so a
/// failed delete keeps the list on screen and says why in a snackbar.
class AddressBookState extends Equatable {
  const AddressBookState({
    this.status = ViewStatus.initial,
    this.book = const AddressBook(),
    this.actionStatus = ViewStatus.initial,
    this.lastAction,
    this.errorMessage,
  });

  final ViewStatus status;
  final AddressBook book;
  final ViewStatus actionStatus;

  /// What [actionStatus] is about, for the right "saved" / "deleted" line.
  final AddressBookAction? lastAction;
  final String? errorMessage;

  /// Default first, then the most recently changed.
  List<SavedAddress> get addresses => book.sorted;

  bool get isBusy => actionStatus.isLoading;

  AddressBookState copyWith({
    ViewStatus? status,
    AddressBook? book,
    ViewStatus? actionStatus,
    AddressBookAction? lastAction,
    String? errorMessage,
  }) {
    return AddressBookState(
      status: status ?? this.status,
      book: book ?? this.book,
      actionStatus: actionStatus ?? this.actionStatus,
      lastAction: lastAction ?? this.lastAction,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, book, actionStatus, lastAction, errorMessage];
}
