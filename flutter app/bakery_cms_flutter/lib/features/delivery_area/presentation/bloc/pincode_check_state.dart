import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/delivery_area.dart';

/// One PIN code check in the pincode sheet. [answer] is not chosen until the
/// customer presses Save.
class PincodeCheckState extends Equatable {
  const PincodeCheckState({
    this.status = ViewStatus.initial,
    this.pincode = '',
    this.answer,
    this.errorMessage,
  });

  final ViewStatus status;

  /// The PIN code asked about.
  final String pincode;
  final DeliveryArea? answer;
  final String? errorMessage;

  @override
  List<Object?> get props => [status, pincode, answer, errorMessage];
}
