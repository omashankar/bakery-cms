import '../entities/contact_channel.dart';

/// Opens the dialer or the mail app on the shop's number or address.
///
/// Answers false when nothing could open it (no dialer on a tablet, no mail
/// app): the caller then copies the value instead.
abstract interface class ContactLauncher {
  Future<bool> open(ContactChannel channel, String value);
}
