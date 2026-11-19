import 'package:flutter/material.dart';

import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/rating_tone.dart';

/// The theme's colour for a [RatingTone]: good in the success tone the
/// product page's rating badge already uses, poor in the error tone.
extension RatingToneColour on BuildContext {
  Color ratingColour(RatingTone tone) => switch (tone) {
    RatingTone.good => colors.tertiary,
    RatingTone.fair => colors.primary,
    RatingTone.poor => colors.error,
  };
}
