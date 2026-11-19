import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/no_params.dart';
import '../../../../core/utils/view_status.dart';
import '../../../auth/domain/usecases/delete_account.dart';
import 'delete_account_state.dart';

class DeleteAccountCubit extends Cubit<DeleteAccountState> {
  DeleteAccountCubit(this._deleteAccount) : super(const DeleteAccountState());

  final DeleteAccount _deleteAccount;

  /// Answers whether the shop deleted the account. The answer is returned as
  /// well as emitted because a success signs the customer out, and the router
  /// may close this screen (and this cubit) before the result arrives.
  Future<bool> delete() async {
    if (state.status.isLoading) return false;
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _deleteAccount(const NoParams());
    final deleted = result.isRight();
    if (isClosed) return deleted;
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (_) => emit(state.copyWith(status: ViewStatus.success)),
    );
    return deleted;
  }
}
