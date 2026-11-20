import 'package:equatable/equatable.dart';

/// What a repository returns instead of throwing. [message] is always safe to
/// show a customer.
abstract class Failure extends Equatable {
  const Failure(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
