/// The module keys the shop's public settings send under `modules`
/// (`ModuleSettings` in the website's `types/settings.ts`).
///
/// Pass one to `StoreConfig.isModuleOn`. A key the shop does not send is on.
abstract final class StoreModules {
  static const String flavour = 'flavour';
  static const String weight = 'weight';
  static const String shape = 'shape';
  static const String photoCake = 'photoCake';
}
