import 'package:equatable/equatable.dart';

/// What the map shows at a refused pin (`found` in the delivery-pin answer).
class PinFound extends Equatable {
  const PinFound({this.postalCode, this.city, this.state, this.formattedAddress});

  final String? postalCode;
  final String? city;
  final String? state;
  final String? formattedAddress;

  @override
  List<Object?> get props => [postalCode, city, state, formattedAddress];
}
