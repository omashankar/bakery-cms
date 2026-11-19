import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/pincode_place.dart';

/// What the directory said about the PIN in the box.
///
/// [place] belongs to [pincode] only: success with a null place is a PIN
/// India Post does not list; failure is a directory that could not be asked,
/// which a form keeps to itself.
class PincodePlaceState extends Equatable {
  const PincodePlaceState({this.status = ViewStatus.initial, this.pincode = '', this.place});

  final ViewStatus status;
  final String pincode;
  final PincodePlace? place;

  @override
  List<Object?> get props => [status, pincode, place];
}
