import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import 'avatar_change.dart';

/// Changing the profile photo: initial → loading → success | failure.
///
/// The photo itself is not kept here: the saved account goes to the auth
/// repository, and every screen showing the customer redraws from that.
class AvatarState extends Equatable {
  const AvatarState({this.status = ViewStatus.initial, this.change, this.errorMessage});

  final ViewStatus status;

  /// Set with [ViewStatus.success].
  final AvatarChange? change;
  final String? errorMessage;

  @override
  List<Object?> get props => [status, change, errorMessage];
}
