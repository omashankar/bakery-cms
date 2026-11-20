import 'package:equatable/equatable.dart';

class RequestCodeParams extends Equatable {
  const RequestCodeParams({required this.email, this.name});

  final String email;

  /// Only used by the shop when the account does not exist yet.
  final String? name;

  @override
  List<Object?> get props => [email, name];
}
