import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';

/// Saving the profile: initial → loading → success | failure.
class ProfileState extends Equatable {
  const ProfileState({this.status = ViewStatus.initial, this.errorMessage});

  final ViewStatus status;
  final String? errorMessage;

  ProfileState copyWith({ViewStatus? status, String? errorMessage}) {
    return ProfileState(status: status ?? this.status, errorMessage: errorMessage);
  }

  @override
  List<Object?> get props => [status, errorMessage];
}
