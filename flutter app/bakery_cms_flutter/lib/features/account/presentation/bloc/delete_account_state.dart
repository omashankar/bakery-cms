import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';

/// Deleting the account: initial → loading → success | failure.
class DeleteAccountState extends Equatable {
  const DeleteAccountState({this.status = ViewStatus.initial, this.errorMessage});

  final ViewStatus status;
  final String? errorMessage;

  DeleteAccountState copyWith({ViewStatus? status, String? errorMessage}) {
    return DeleteAccountState(status: status ?? this.status, errorMessage: errorMessage);
  }

  @override
  List<Object?> get props => [status, errorMessage];
}
