import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/context_extensions.dart';

/// The search box in the search page's header, drawn as the home page's
/// search box it was opened from: a soft rounded field with the glass at its
/// start. No floating label (it was squeezed against the top of the bar), and
/// a clear button once there is something to clear.
class SearchField extends StatefulWidget {
  const SearchField({
    super.key,
    required this.onChanged,
    this.initialQuery = '',
    this.autofocus = false,
  });

  final ValueChanged<String> onChanged;
  final String initialQuery;
  final bool autofocus;

  @override
  State<SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<SearchField> {
  late final TextEditingController _controller = TextEditingController(text: widget.initialQuery);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _clear() {
    _controller.clear();
    widget.onChanged('');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final rounded = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      borderSide: BorderSide.none,
    );
    return Semantics(
      label: CatalogStrings.searchTitle,
      textField: true,
      child: TextField(
        controller: _controller,
        autofocus: widget.autofocus,
        textInputAction: TextInputAction.search,
        onChanged: widget.onChanged,
        style: context.text.bodyLarge,
        decoration: InputDecoration(
          isDense: true,
          filled: true,
          fillColor: colors.surfaceContainerHighest,
          hintText: CatalogStrings.searchHint,
          hintStyle: context.text.bodyMedium?.copyWith(color: colors.onSurfaceVariant),
          prefixIcon: Icon(Icons.search, color: colors.onSurfaceVariant),
          suffixIcon: ValueListenableBuilder<TextEditingValue>(
            valueListenable: _controller,
            builder: (context, value, _) => value.text.isEmpty
                ? const SizedBox.shrink()
                : IconButton(
                    tooltip: CatalogStrings.clearSearch,
                    icon: const Icon(Icons.close),
                    onPressed: _clear,
                  ),
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          border: rounded,
          enabledBorder: rounded,
          focusedBorder: rounded.copyWith(
            borderSide: BorderSide(color: colors.primary),
          ),
        ),
      ),
    );
  }
}
