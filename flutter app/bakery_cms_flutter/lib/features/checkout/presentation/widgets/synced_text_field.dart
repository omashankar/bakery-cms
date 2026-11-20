import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/widgets/app_text_field.dart';

/// An [AppTextField] whose text follows [value].
///
/// Typing reports through [onChanged] and comes back as the same [value], so
/// nothing moves. A value that changes from outside (city and PIN filled in
/// from the map pin, name from the account) replaces the text.
class SyncedTextField extends StatefulWidget {
  const SyncedTextField({
    super.key,
    required this.value,
    required this.label,
    required this.onChanged,
    this.validator,
    this.keyboardType,
    this.textInputAction = TextInputAction.next,
    this.inputFormatters,
    this.maxLength,
    this.maxLines = 1,
    this.autofillHints,
    this.textCapitalization = TextCapitalization.none,
    this.errorText,
    this.prefixIcon,
  });

  final String value;
  final String label;
  final ValueChanged<String> onChanged;
  final FormFieldValidator<String>? validator;
  final TextInputType? keyboardType;
  final TextInputAction textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;
  final int maxLines;
  final Iterable<String>? autofillHints;
  final TextCapitalization textCapitalization;
  final String? errorText;
  final IconData? prefixIcon;

  @override
  State<SyncedTextField> createState() => _SyncedTextFieldState();
}

class _SyncedTextFieldState extends State<SyncedTextField> {
  late final TextEditingController _controller = TextEditingController(text: widget.value);

  @override
  void didUpdateWidget(SyncedTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value == _controller.text) return;
    // After this frame, not during it. Changing the controller here tells the
    // field, and through it the whole Form, to rebuild while the framework is
    // already building, which Flutter reports as an error ("This Form widget
    // cannot be marked as needing to build…").
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || widget.value == _controller.text) return;
      _controller.value = TextEditingValue(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppTextField(
      controller: _controller,
      label: widget.label,
      onChanged: widget.onChanged,
      validator: widget.validator,
      keyboardType: widget.keyboardType,
      textInputAction: widget.textInputAction,
      inputFormatters: widget.inputFormatters,
      maxLength: widget.maxLength,
      maxLines: widget.maxLines,
      autofillHints: widget.autofillHints,
      textCapitalization: widget.textCapitalization,
      errorText: widget.errorText,
      prefixIcon: widget.prefixIcon,
    );
  }
}
