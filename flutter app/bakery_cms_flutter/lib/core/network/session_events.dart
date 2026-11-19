import 'dart:async';

/// A broadcast of "the shop no longer recognises this customer's session".
///
/// The error interceptor raises it on a 401; the auth repository listens and
/// signs the app out. Neither knows about the other.
class SessionEvents {
  final StreamController<void> _expired = StreamController<void>.broadcast();

  Stream<void> get expired => _expired.stream;

  void notifyExpired() => _expired.add(null);

  Future<void> dispose() => _expired.close();
}
