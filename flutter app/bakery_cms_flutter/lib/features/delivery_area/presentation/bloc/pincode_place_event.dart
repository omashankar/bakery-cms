import 'package:equatable/equatable.dart';

/// The PIN box now reads [pincode] (typed, pasted or filled in).
class PincodePlaceTyped extends Equatable {
  const PincodePlaceTyped(this.pincode);

  final String pincode;

  @override
  List<Object?> get props => [pincode];
}
