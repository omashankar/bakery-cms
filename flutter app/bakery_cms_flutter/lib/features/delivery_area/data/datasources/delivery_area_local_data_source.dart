import '../models/delivery_area_model.dart';

abstract interface class DeliveryAreaLocalDataSource {
  /// The kept area, or null when none was kept. Throws `CacheException` when
  /// what is kept cannot be read.
  Future<DeliveryAreaModel?> read();

  Future<void> write(DeliveryAreaModel area);
}
