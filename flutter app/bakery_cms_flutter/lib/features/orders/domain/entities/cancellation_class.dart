/// How freely an order may be cancelled (`CancellationClass` on the server).
enum CancellationClass {
  standard('standard'),
  madeToOrder('made_to_order'),
  nonCancellable('non_cancellable');

  const CancellationClass(this.apiValue);

  final String apiValue;

  /// Unknown or missing counts as [standard], as the server's default does.
  static CancellationClass fromApi(Object? value) => CancellationClass.values.firstWhere(
    (cls) => cls.apiValue == value,
    orElse: () => CancellationClass.standard,
  );
}
