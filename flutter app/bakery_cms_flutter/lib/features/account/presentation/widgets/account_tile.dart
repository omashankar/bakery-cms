import 'package:flutter/material.dart';

import '../../../../core/utils/context_extensions.dart';

class AccountTile extends StatelessWidget {
  const AccountTile({
    super.key,
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.destructive = false,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? context.colors.error : null;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: color),
      title: Text(title, style: context.text.bodyLarge?.copyWith(color: color)),
      subtitle: subtitle == null ? null : Text(subtitle!),
      trailing: destructive ? null : const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
