import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/strings/support_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../domain/entities/contact_channel.dart';
import '../../domain/services/contact_launcher.dart';

/// One way to reach the shop: an icon, what it is, and the value.
///
/// A phone or an email ([channel]) opens the dialer or the mail app on a tap,
/// the website's `tel:` / `mailto:` link; when no app takes it, the value is
/// copied instead, and the copy button beside it copies at any time. Without
/// a [channel] (the address) the value is only there to read and select.
class ContactDetailTile extends StatelessWidget {
  const ContactDetailTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.channel,
    this.launcher,
  });

  final IconData icon;
  final String label;
  final String value;
  final ContactChannel? channel;

  /// Opens the link; the app-wide one when null (read on the tap only).
  final ContactLauncher? launcher;

  Future<void> _copy(BuildContext context, String message) async {
    await Clipboard.setData(ClipboardData(text: value));
    if (context.mounted) AppSnackbar.success(context, message);
  }

  Future<void> _open(BuildContext context, ContactChannel channel) async {
    final opener = launcher ?? GetIt.I<ContactLauncher>();
    final opened = await opener.open(channel, value);
    if (!opened && context.mounted) await _copy(context, SupportStrings.copiedNoApp);
  }

  @override
  Widget build(BuildContext context) {
    final link = channel;
    final tile = ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: context.colors.primary),
      title: Text(label, style: context.text.titleSmall),
      // Plain text where a tap opens the link: selectable text would take
      // the tap for itself.
      subtitle: link == null ? SelectableText(value) : Text(value),
      onTap: link == null ? null : () => _open(context, link),
      trailing: link == null
          ? null
          : IconButton(
              tooltip: SupportStrings.copyHint,
              icon: const Icon(Icons.copy_outlined),
              onPressed: () => _copy(context, SupportStrings.copied),
            ),
    );
    if (link == null) return tile;
    return Semantics(
      hint: link == ContactChannel.phone ? SupportStrings.tapToCall : SupportStrings.tapToEmail,
      child: tile,
    );
  }
}
