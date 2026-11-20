import 'package:equatable/equatable.dart';

class GetCurrentLocationParams extends Equatable {
  const GetCurrentLocationParams({required this.askPermission});

  /// False reads the position only if the customer already allowed it, and
  /// never shows the system prompt: the app asks for location only when the
  /// customer taps "Use my current location" (as the privacy policy says).
  final bool askPermission;

  @override
  List<Object?> get props => [askPermission];
}
