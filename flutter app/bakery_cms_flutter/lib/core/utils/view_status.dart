/// The one status vocabulary every screen state uses.
enum ViewStatus {
  initial,
  loading,
  success,
  failure;

  bool get isInitial => this == ViewStatus.initial;
  bool get isLoading => this == ViewStatus.loading;
  bool get isSuccess => this == ViewStatus.success;
  bool get isFailure => this == ViewStatus.failure;

  /// Nothing to show yet: the first load has not finished.
  bool get isPending => isInitial || isLoading;
}
