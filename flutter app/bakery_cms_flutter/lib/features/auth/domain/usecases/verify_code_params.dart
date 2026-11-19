import 'package:equatable/equatable.dart';

class VerifyCodeParams extends Equatable {
  const VerifyCodeParams({required this.email, required this.code});

  final String email;
  final String code;

  @override
  List<Object?> get props => [email, code];
}
