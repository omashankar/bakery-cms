import 'package:flutter/material.dart';

/// The storefront's palette (app/globals.css), so the app and the website
/// read as one shop. Widgets never use these directly — they read
/// `Theme.of(context).colorScheme`, which [AppTheme] builds from them.
abstract final class AppColors {
  static const Color primary = Color(0xFF6F4E37);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color secondary = Color(0xFFFAF8F4);
  static const Color onSecondary = Color(0xFF2D2D2D);
  static const Color background = Color(0xFFFFFFFF);
  static const Color foreground = Color(0xFF2D2D2D);
  static const Color muted = Color(0xFFF5F2EC);
  static const Color mutedForeground = Color(0xFF6B6259);
  static const Color border = Color(0xFFE8E5DF);
  static const Color error = Color(0xFFDC2626);
  static const Color success = Color(0xFF15803D);
  static const Color rating = Color(0xFFF59E0B);

  static const Color primaryDark = Color(0xFFD4A373);

  /// Secondary text in dark mode (the website's --muted-foreground). Not
  /// the caramel accent, which turned every subtitle and price label gold.
  static const Color mutedForegroundDark = Color(0xFFE4D5C2);
  static const Color backgroundDark = Color(0xFF241810);
  static const Color foregroundDark = Color(0xFFFAF8F4);
  static const Color mutedDark = Color(0xFF4A3324);
  static const Color secondaryDark = Color(0xFF5A3F2B);
  static const Color borderDark = Color(0xFF5C4638);
  static const Color errorDark = Color(0xFFF87171);

  // Home section grounds (the website's --surface-cream and --band-* tones),
  // read through SectionTones, never directly.
  static const Color bandCream = Color(0xFFFAF8F4);
  static const Color bandPanel = Color(0xFFF5F2EC);
  static const Color bandRose = Color(0xFFFDF2F5);
  static const Color bandMint = Color(0xFFF1F8F2);
  static const Color bandSand = Color(0xFFFDF8EC);
  static const Color bandSky = Color(0xFFF1F6FD);
  static const Color bandPanelStrong = Color(0xFFE8E5DF);
  static const Color bandRoseStrong = Color(0xFFF9D5E0);
  static const Color bandMintStrong = Color(0xFFD3EBD7);
  static const Color bandSandStrong = Color(0xFFFBEAC2);
  static const Color bandSkyStrong = Color(0xFFD5E5FA);

  static const Color bandCreamDark = Color(0xFF4A3324);
  static const Color bandPanelDark = Color(0xFF33251B);
  static const Color bandRoseDark = Color(0xFF3A2A30);
  static const Color bandMintDark = Color(0xFF26332A);
  static const Color bandSandDark = Color(0xFF383021);
  static const Color bandSkyDark = Color(0xFF242E3A);
  static const Color bandPanelStrongDark = Color(0xFF5A3F2B);
  static const Color bandRoseStrongDark = Color(0xFF553A44);
  static const Color bandMintStrongDark = Color(0xFF37493C);
  static const Color bandSandStrongDark = Color(0xFF50442D);
  static const Color bandSkyStrongDark = Color(0xFF334152);
}
