/// Whether the device has a network at all. Checked before a request so an
/// offline customer gets the "no internet" message immediately rather than
/// after a timeout.
abstract interface class NetworkInfo {
  Future<bool> get isConnected;
}
