import 'package:url_launcher/url_launcher.dart';

import '../../domain/entities/contact_channel.dart';
import '../../domain/services/contact_launcher.dart';
import '../../domain/services/contact_links.dart';

/// [ContactLauncher] through `url_launcher`, in the app that owns the link
/// (the dialer, the mail app), never a browser.
///
/// Every failure is "could not open", never a crash: a device with no app
/// for the link throws on some platforms and answers false on others.
class UrlContactLauncher implements ContactLauncher {
  const UrlContactLauncher();

  @override
  Future<bool> open(ContactChannel channel, String value) async {
    final link = ContactLinks.of(channel, value);
    if (link == null) return false;
    try {
      return await launchUrl(link, mode: LaunchMode.externalApplication);
    } on Object {
      return false;
    }
  }
}
