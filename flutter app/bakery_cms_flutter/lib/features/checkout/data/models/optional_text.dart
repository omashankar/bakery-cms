/// An optional field the shop's API takes as absent, not as "" or null.
String? optionalText(String? value) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? null : trimmed;
}
