enum StockStatus {
  inStock('in_stock'),
  lowStock('low_stock'),
  outOfStock('out_of_stock');

  const StockStatus(this.apiValue);

  final String apiValue;

  static StockStatus fromApi(Object? value) => StockStatus.values.firstWhere(
    (status) => status.apiValue == value,
    orElse: () => StockStatus.inStock,
  );
}
