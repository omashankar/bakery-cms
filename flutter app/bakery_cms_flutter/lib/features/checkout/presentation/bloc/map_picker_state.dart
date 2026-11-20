import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/geo_point.dart';

class MapPickerState extends Equatable {
  const MapPickerState({
    required this.center,
    this.locateStatus = ViewStatus.initial,
    this.recenterId = 0,
    this.errorMessage,
  });

  /// Where the pin is: the map's centre.
  final GeoPoint center;
  final ViewStatus locateStatus;

  /// Bumped when the map must move to [center] (after "use my location"),
  /// as opposed to the customer moving it.
  final int recenterId;
  final String? errorMessage;

  MapPickerState copyWith({
    GeoPoint? center,
    ViewStatus? locateStatus,
    int? recenterId,
    String? errorMessage,
  }) {
    return MapPickerState(
      center: center ?? this.center,
      locateStatus: locateStatus ?? this.locateStatus,
      recenterId: recenterId ?? this.recenterId,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [center, locateStatus, recenterId, errorMessage];
}
