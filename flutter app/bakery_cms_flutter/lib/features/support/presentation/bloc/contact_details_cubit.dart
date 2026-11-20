import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/no_params.dart';
import '../../../../core/utils/view_status.dart';
import '../../domain/usecases/get_shop_contact.dart';
import 'contact_details_state.dart';

/// The shop's address, phone, email and hours, beside the contact form.
class ContactDetailsCubit extends Cubit<ContactDetailsState> {
  ContactDetailsCubit(this._getShopContact) : super(const ContactDetailsState());

  final GetShopContact _getShopContact;

  Future<void> load() async {
    if (state.status.isLoading) return;
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _getShopContact(const NoParams());
    if (isClosed) return;
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (contact) => emit(state.copyWith(status: ViewStatus.success, contact: contact)),
    );
  }
}
