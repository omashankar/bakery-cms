import 'package:flutter/material.dart';

import '../constants/app_strings.dart';
import 'message_view.dart';

class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    this.title = AppStrings.nothingHere,
    this.message,
    this.icon = Icons.inbox_outlined,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return MessageView(
      icon: icon,
      title: title,
      message: message,
      actionLabel: actionLabel,
      onAction: onAction,
    );
  }
}
