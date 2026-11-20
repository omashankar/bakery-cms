import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/error/server_failure.dart';
import '../../../../core/utils/view_status.dart';
import '../../domain/entities/contact_message.dart';
import '../../domain/usecases/send_contact_message.dart';
import 'contact_form_state.dart';

/// Sends the contact form. Simple state, so a Cubit.
class ContactFormCubit extends Cubit<ContactFormState> {
  ContactFormCubit(this._sendContactMessage) : super(const ContactFormState());

  final SendContactMessage _sendContactMessage;

  Future<void> submit(ContactMessage message) async {
    // One enquiry per tap: the shop rate-limits by email, and a second copy
    // only clutters the queue a person works through.
    if (state.status.isLoading || state.status.isSuccess) return;
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _sendContactMessage(message);
    if (isClosed) return;
    result.match(
      (failure) => emit(
        state.copyWith(
          status: ViewStatus.failure,
          errorMessage: failure.message,
          errorField: failure is ServerFailure ? failure.field : null,
        ),
      ),
      (_) => emit(state.copyWith(status: ViewStatus.success)),
    );
  }
}
