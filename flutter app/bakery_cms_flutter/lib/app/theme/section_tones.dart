import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../features/home_layout/domain/entities/section_tone.dart';

/// The grounds home sections are drawn on, light and dark, plus a stronger
/// shade of each for the "View all" pill that sits on it (as the website
/// does: a pink band carries a pink button, never a grey one).
@immutable
class SectionTones extends ThemeExtension<SectionTones> {
  const SectionTones({required this.grounds, required this.strong});

  final Map<SectionTone, Color> grounds;
  final Map<SectionTone, Color> strong;

  static const SectionTones light = SectionTones(
    grounds: {
      SectionTone.cream: AppColors.bandCream,
      SectionTone.panel: AppColors.bandPanel,
      SectionTone.rose: AppColors.bandRose,
      SectionTone.mint: AppColors.bandMint,
      SectionTone.sand: AppColors.bandSand,
      SectionTone.sky: AppColors.bandSky,
    },
    strong: {
      SectionTone.panel: AppColors.bandPanelStrong,
      SectionTone.rose: AppColors.bandRoseStrong,
      SectionTone.mint: AppColors.bandMintStrong,
      SectionTone.sand: AppColors.bandSandStrong,
      SectionTone.sky: AppColors.bandSkyStrong,
    },
  );

  static const SectionTones dark = SectionTones(
    grounds: {
      SectionTone.cream: AppColors.bandCreamDark,
      SectionTone.panel: AppColors.bandPanelDark,
      SectionTone.rose: AppColors.bandRoseDark,
      SectionTone.mint: AppColors.bandMintDark,
      SectionTone.sand: AppColors.bandSandDark,
      SectionTone.sky: AppColors.bandSkyDark,
    },
    strong: {
      SectionTone.panel: AppColors.bandPanelStrongDark,
      SectionTone.rose: AppColors.bandRoseStrongDark,
      SectionTone.mint: AppColors.bandMintStrongDark,
      SectionTone.sand: AppColors.bandSandStrongDark,
      SectionTone.sky: AppColors.bandSkyStrongDark,
    },
  );

  /// The ground for [tone]; null for the plain page.
  Color? groundOf(SectionTone tone) => grounds[tone];

  /// The pill colour on [tone]; null where the theme's own button fits.
  Color? strongOf(SectionTone tone) => strong[tone];

  static SectionTones of(BuildContext context) =>
      Theme.of(context).extension<SectionTones>() ?? light;

  @override
  SectionTones copyWith({Map<SectionTone, Color>? grounds, Map<SectionTone, Color>? strong}) =>
      SectionTones(grounds: grounds ?? this.grounds, strong: strong ?? this.strong);

  @override
  SectionTones lerp(covariant SectionTones? other, double t) {
    if (other == null) return this;
    Map<SectionTone, Color> mix(Map<SectionTone, Color> a, Map<SectionTone, Color> b) => {
      for (final tone in {...a.keys, ...b.keys})
        tone: Color.lerp(a[tone], b[tone], t) ?? b[tone] ?? a[tone]!,
    };
    return SectionTones(grounds: mix(grounds, other.grounds), strong: mix(strong, other.strong));
  }
}
