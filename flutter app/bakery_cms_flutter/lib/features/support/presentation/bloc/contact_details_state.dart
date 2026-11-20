import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/shop_contact.dart';

class ContactDetailsState extends Equatable {
  const ContactDetailsState({
    this.status = ViewStatus.initial,
    this.contact = const ShopContact(),
    this.errorMessage,
  });

  final ViewStatus status;
  final ShopContact contact;
  final String? errorMessage;

  ContactDetailsState copyWith({ViewStatus? status, ShopContact? contact, String? errorMessage}) {
    return ContactDetailsState(
      status: status ?? this.status,
      contact: contact ?? this.contact,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, contact, errorMessage];
}
