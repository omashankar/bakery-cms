import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_durations.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/utils/view_status.dart';
import '../../domain/usecases/get_store_config.dart';
import 'store_config_state.dart';

/// The shop's public settings, loaded once at start and read by checkout
/// (delivery tiers, slots, payment methods) and the home header.
///
/// A failed load is retried in the background ([retryDelays]); [loadIfNeeded]
/// lets a screen ask again sooner (pull to refresh).
class StoreConfigCubit extends Cubit<StoreConfigState> {
  StoreConfigCubit(
    this._getStoreConfig, {
    List<Duration> retryDelays = AppDurations.backgroundRetries,
  }) : _retryDelays = retryDelays,
       super(const StoreConfigState());

  final GetStoreConfig _getStoreConfig;
  final List<Duration> _retryDelays;
  Timer? _retry;
  int _attempt = 0;

  Future<void> load() async {
    _retry?.cancel();
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _getStoreConfig(const NoParams());
    if (isClosed) return;
    result.match(
      (failure) {
        emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message));
        _scheduleRetry();
      },
      (config) {
        _attempt = 0;
        emit(state.copyWith(status: ViewStatus.success, config: config));
      },
    );
  }

  /// Loads unless the settings are already here or on their way.
  Future<void> loadIfNeeded() async {
    if (state.status.isSuccess || state.status.isLoading) return;
    await load();
  }

  void _scheduleRetry() {
    if (_attempt >= _retryDelays.length) return;
    _retry = Timer(_retryDelays[_attempt++], () => unawaited(load()));
  }

  @override
  Future<void> close() {
    _retry?.cancel();
    return super.close();
  }
}
