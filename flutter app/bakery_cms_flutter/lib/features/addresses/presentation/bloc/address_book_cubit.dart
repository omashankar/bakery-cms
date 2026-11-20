import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/utils/view_status.dart';
import '../../domain/entities/address_book.dart';
import '../../domain/entities/saved_address.dart';
import '../../domain/usecases/delete_address.dart';
import '../../domain/usecases/load_address_book.dart';
import '../../domain/usecases/save_address.dart';
import '../../domain/usecases/set_default_address.dart';
import 'address_book_action.dart';
import 'address_book_state.dart';

class AddressBookCubit extends Cubit<AddressBookState> {
  AddressBookCubit({
    required LoadAddressBook loadAddressBook,
    required SaveAddress saveAddress,
    required DeleteAddress deleteAddress,
    required SetDefaultAddress setDefaultAddress,
  })  : _load = loadAddressBook,
        _save = saveAddress,
        _delete = deleteAddress,
        _setDefault = setDefaultAddress,
        super(const AddressBookState());

  final LoadAddressBook _load;
  final SaveAddress _save;
  final DeleteAddress _delete;
  final SetDefaultAddress _setDefault;

  Future<void> load({bool forceRefresh = false}) async {
    if (state.status.isLoading) return;
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _load(forceRefresh: forceRefresh);
    if (isClosed) return;
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (book) => emit(state.copyWith(status: ViewStatus.success, book: book)),
    );
  }

  Future<void> save(SavedAddress address) =>
      _change(AddressBookAction.save, () => _save(address));

  Future<void> delete(String id) => _change(AddressBookAction.delete, () => _delete(id));

  Future<void> makeDefault(String id) =>
      _change(AddressBookAction.makeDefault, () => _setDefault(id));

  /// One change at a time: each saves the whole book, so two racing would
  /// let the older list land last.
  Future<void> _change(
    AddressBookAction action,
    Future<Either<Failure, AddressBook>> Function() run,
  ) async {
    if (state.isBusy) return;
    emit(state.copyWith(actionStatus: ViewStatus.loading, lastAction: action));
    final result = await run();
    if (isClosed) return;
    result.match(
      (failure) => emit(
        state.copyWith(actionStatus: ViewStatus.failure, errorMessage: failure.message),
      ),
      (book) => emit(
        state.copyWith(status: ViewStatus.success, book: book, actionStatus: ViewStatus.success),
      ),
    );
  }

  /// Back to idle when the form is opened again.
  void resetAction() => emit(state.copyWith(actionStatus: ViewStatus.initial));
}
