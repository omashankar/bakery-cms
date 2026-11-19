import '../../../store/domain/entities/store_config.dart';
import '../../../store/domain/entities/store_modules.dart';
import '../../domain/entities/product_modules.dart';

/// The shop's module switches as the catalog reads them. Before the settings
/// arrive every module is on, as the website fails open.
abstract final class ProductModulesReader {
  static ProductModules of(StoreConfig? config) {
    if (config == null) return ProductModules.all;
    return ProductModules(
      weight: config.isModuleOn(StoreModules.weight),
      shape: config.isModuleOn(StoreModules.shape),
      photoCake: config.isModuleOn(StoreModules.photoCake),
    );
  }
}
