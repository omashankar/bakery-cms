import 'dart:async';

/// A broadcast of "the customer's orders changed on the shop".
///
/// Checkout raises it after placing an order and the orders repository after
/// a cancellation; the order list listens and reloads. Without it the list,
/// which stays alive in its tab, kept showing a cancelled order as Confirmed
/// and never showed an order placed after it first loaded. Like
/// [SessionEvents], neither side knows about the other.
class OrderEvents {
  final StreamController<void> _changed = StreamController<void>.broadcast();

  Stream<void> get changed => _changed.stream;

  void notifyChanged() => _changed.add(null);

  Future<void> dispose() => _changed.close();
}
