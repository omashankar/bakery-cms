import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/store_config.dart';

class StoreConfigState extends Equatable {
  const StoreConfigState({this.status = ViewStatus.initial, this.config, this.errorMessage});

  final ViewStatus status;
  final StoreConfig? config;
  final String? errorMessage;

  StoreConfigState copyWith({ViewStatus? status, StoreConfig? config, String? errorMessage}) {
    return StoreConfigState(
      status: status ?? this.status,
      config: config ?? this.config,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, config, errorMessage];
}
