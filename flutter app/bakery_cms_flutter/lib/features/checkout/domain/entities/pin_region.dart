import 'package:equatable/equatable.dart';

/// The pin's district(s) and state as the server read them: what the order
/// is priced by (`region` in the delivery-pin answer).
class PinRegion extends Equatable {
  const PinRegion({this.state, this.districts = const []});

  final String? state;
  final List<String> districts;

  @override
  List<Object?> get props => [state, districts];
}
