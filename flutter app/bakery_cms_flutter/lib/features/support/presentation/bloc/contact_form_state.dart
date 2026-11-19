import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';

/// Sending the contact form: initial → loading → success (the thank-you
/// view) | failure (the form stays, with what was typed still in it).
class ContactFormState extends Equatable {
  const ContactFormState({this.status = ViewStatus.initial, this.errorMessage, this.errorField});

  final ViewStatus status;
  final String? errorMessage;

  /// The field the shop refused ("email"), so the form can point at it.
  final String? errorField;

  ContactFormState copyWith({ViewStatus? status, String? errorMessage, String? errorField}) {
    return ContactFormState(
      status: status ?? this.status,
      errorMessage: errorMessage,
      errorField: errorField,
    );
  }

  @override
  List<Object?> get props => [status, errorMessage, errorField];
}
