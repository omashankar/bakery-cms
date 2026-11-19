import 'package:flutter/material.dart';

/// Short reads of the theme, so widgets say `context.colors.primary` rather
/// than reaching for a constant.
extension ThemeContext on BuildContext {
  ThemeData get theme => Theme.of(this);
  ColorScheme get colors => Theme.of(this).colorScheme;
  TextTheme get text => Theme.of(this).textTheme;
}
