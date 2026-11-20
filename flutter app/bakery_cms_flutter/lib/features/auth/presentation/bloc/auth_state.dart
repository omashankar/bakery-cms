import 'package:equatable/equatable.dart';

import '../../domain/entities/customer.dart';
import 'auth_status.dart';

class AuthState extends Equatable {
  const AuthState({this.status = AuthStatus.unknown, this.customer});

  const AuthState.authenticated(Customer this.customer) : status = AuthStatus.authenticated;

  const AuthState.unauthenticated() : status = AuthStatus.unauthenticated, customer = null;

  final AuthStatus status;
  final Customer? customer;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({AuthStatus? status, Customer? customer}) {
    return AuthState(status: status ?? this.status, customer: customer ?? this.customer);
  }

  @override
  List<Object?> get props => [status, customer];
}
