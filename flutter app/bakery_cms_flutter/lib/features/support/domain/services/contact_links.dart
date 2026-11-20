import '../entities/contact_channel.dart';

/// The link a phone number or an email address opens, as the website's
/// contact and FAQ pages write it: `tel:` with every space taken out of the
/// number, `mailto:` with the address as the shop published it.
abstract final class ContactLinks {
  static final RegExp _spaces = RegExp(r'\s');

  static const String telScheme = 'tel';
  static const String mailtoScheme = 'mailto';

  /// Null when there is nothing to open.
  static Uri? of(ContactChannel channel, String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    return switch (channel) {
      ContactChannel.phone => Uri(scheme: telScheme, path: trimmed.replaceAll(_spaces, '')),
      ContactChannel.email => Uri(scheme: mailtoScheme, path: trimmed),
    };
  }
}
