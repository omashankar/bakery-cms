import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import 'section_tones.dart';

/// The single place colours, type and shapes are decided.
///
/// Type follows the website: plain, semibold headings, body text never bold.
abstract final class AppTheme {
  static ThemeData get light => _build(
    SectionTones.light,
    const ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.primary,
      onPrimary: AppColors.onPrimary,
      secondary: AppColors.secondary,
      onSecondary: AppColors.onSecondary,
      error: AppColors.error,
      onError: AppColors.onPrimary,
      surface: AppColors.background,
      onSurface: AppColors.foreground,
      surfaceContainerHighest: AppColors.muted,
      onSurfaceVariant: AppColors.mutedForeground,
      outline: AppColors.border,
      outlineVariant: AppColors.border,
      tertiary: AppColors.success,
      onTertiary: AppColors.onPrimary,
      errorContainer: AppColors.errorSoft,
      onErrorContainer: AppColors.onErrorSoft,
      tertiaryContainer: AppColors.successSoft,
      onTertiaryContainer: AppColors.onSuccessSoft,
      primaryContainer: AppColors.primarySoft,
      onPrimaryContainer: AppColors.primary,
    ),
  );

  static ThemeData get dark => _build(
    SectionTones.dark,
    const ColorScheme(
      brightness: Brightness.dark,
      primary: AppColors.primaryDark,
      onPrimary: AppColors.backgroundDark,
      secondary: AppColors.secondaryDark,
      onSecondary: AppColors.foregroundDark,
      error: AppColors.errorDark,
      onError: AppColors.backgroundDark,
      surface: AppColors.backgroundDark,
      onSurface: AppColors.foregroundDark,
      surfaceContainerHighest: AppColors.mutedDark,
      onSurfaceVariant: AppColors.mutedForegroundDark,
      outline: AppColors.borderDark,
      outlineVariant: AppColors.borderDark,
      tertiary: AppColors.success,
      onTertiary: AppColors.foregroundDark,
      errorContainer: AppColors.errorSoftDark,
      onErrorContainer: AppColors.onErrorSoftDark,
      tertiaryContainer: AppColors.successSoftDark,
      onTertiaryContainer: AppColors.onSuccessSoftDark,
      primaryContainer: AppColors.secondaryDark,
      onPrimaryContainer: AppColors.foregroundDark,
    ),
  );

  static ThemeData _build(SectionTones tones, ColorScheme scheme) {
    final base = ThemeData(useMaterial3: true, colorScheme: scheme);
    final text = base.textTheme.copyWith(
      headlineSmall: base.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
      titleLarge: base.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
      titleMedium: base.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      titleSmall: base.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
    );
    final rounded = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
    );
    final outline = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      borderSide: BorderSide(color: scheme.outline),
    );

    return base.copyWith(
      extensions: [tones],
      textTheme: text,
      scaffoldBackgroundColor: scheme.surface,
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: text.titleLarge?.copyWith(color: scheme.onSurface),
      ),
      cardTheme: CardThemeData(
        color: scheme.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: rounded.copyWith(side: BorderSide(color: scheme.outline)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(AppSpacing.buttonMinWidth, AppSpacing.buttonHeight),
          shape: rounded,
          textStyle: text.titleSmall,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(AppSpacing.buttonMinWidth, AppSpacing.buttonHeight),
          shape: rounded,
          side: BorderSide(color: scheme.primary),
          textStyle: text.titleSmall,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surface,
        border: outline,
        enabledBorder: outline,
        focusedBorder: outline.copyWith(
          borderSide: BorderSide(color: scheme.primary, width: AppSpacing.borderWidth * 2),
        ),
        errorBorder: outline.copyWith(borderSide: BorderSide(color: scheme.error)),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusPill)),
        side: BorderSide(color: scheme.outline),
      ),
      dividerTheme: DividerThemeData(color: scheme.outline, space: AppSpacing.xl),
      snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
      // The footer as the reference draws it: the tab you are on in the
      // shop's colour, icon and name, the others quiet grey; no pill behind
      // it, and no tint over the bar.
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        height: AppSpacing.navigationBarHeight,
        indicatorColor: Colors.transparent,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected) ? scheme.primary : scheme.onSurfaceVariant,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? text.labelMedium?.copyWith(color: scheme.primary, fontWeight: FontWeight.w600)
              : text.labelMedium?.copyWith(color: scheme.onSurfaceVariant),
        ),
      ),
    );
  }
}
