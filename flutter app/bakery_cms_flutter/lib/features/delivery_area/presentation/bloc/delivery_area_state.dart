import 'package:equatable/equatable.dart';

import '../../domain/entities/delivery_area.dart';
import '../../domain/entities/delivery_verdict.dart';
import 'delivery_area_status.dart';

class DeliveryAreaState extends Equatable {
  const DeliveryAreaState({this.status = DeliveryAreaStatus.none, this.area, this.errorMessage});

  final DeliveryAreaStatus status;

  /// The chosen PIN code and the shop's last answer about it. Kept while a
  /// re-check runs or fails, so the customer still sees what they chose.
  final DeliveryArea? area;

  /// Why the last check failed, safe to show.
  final String? errorMessage;

  /// The chosen PIN code, or null when none was chosen.
  String? get pincode => area?.pincode;

  /// The shop does not deliver to the chosen PIN code.
  bool get isNotDelivered =>
      area?.verdict == DeliveryVerdict.outside || area?.verdict == DeliveryVerdict.unknown;

  /// The area's own preparation days, when the shop delivers there.
  int? get minDeliveryDays => isNotDelivered ? null : area?.minDeliveryDays;

  @override
  List<Object?> get props => [status, area, errorMessage];
}
