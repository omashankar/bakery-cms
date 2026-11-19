import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/constants/app_durations.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/home_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../checkout/domain/services/shop_clock.dart';
import '../../domain/entities/countdown_section.dart';
import '../../domain/services/home_catalog_index.dart';
import '../../domain/services/same_day_countdown.dart';
import '../utils/link_opener.dart';
import '../utils/storefront_link.dart';

/// "Order in the next 2h 14m for delivery today", counted on the shop's
/// clock. Gone once the cut-off has passed.
class CountdownBand extends StatefulWidget {
  const CountdownBand({super.key, required this.section, required this.index, this.clock});

  final CountdownSection section;
  final HomeCatalogIndex index;

  /// The shop's clock; tests pin it.
  final ShopClock? clock;

  @override
  State<CountdownBand> createState() => _CountdownBandState();
}

class _CountdownBandState extends State<CountdownBand> {
  Timer? _tick;

  ShopClock get _clock => widget.clock ?? ShopClock(widget.section.timezone);

  @override
  void initState() {
    super.initState();
    // Redrawn on a timer because the time left is the whole message; nothing
    // in the app's state changes when a minute passes.
    _tick = Timer.periodic(AppDurations.countdownTick, (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  static String _format(Duration left) {
    final hours = left.inHours;
    final minutes = left.inMinutes.remainder(Duration.minutesPerHour);
    return hours > 0
        ? '$hours${HomeStrings.hoursShort} $minutes${HomeStrings.minutesShort}'
        : '${left.inMinutes.clamp(1, Duration.minutesPerHour)}${HomeStrings.minutesShort}';
  }

  @override
  Widget build(BuildContext context) {
    final section = widget.section;
    final left = SameDayCountdown.remaining(section.cutoffTime, _clock.now());
    if (left == null) return const SizedBox.shrink();
    final cta = section.cta;
    final route = StorefrontLink.route(cta?.href, widget.index);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      child: Row(
        children: [
          Icon(Icons.timer_outlined, color: context.colors.primary),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(section.headline, style: context.text.titleSmall),
                Text(
                  '${HomeStrings.endsIn} ${_format(left)}',
                  style: context.text.bodySmall?.copyWith(color: context.colors.primary),
                ),
              ],
            ),
          ),
          if (cta != null && route != null)
            FilledButton(
              onPressed: () => LinkOpener.open(context, route),
              child: Text(cta.label, maxLines: 1, softWrap: false),
            ),
        ],
      ),
    );
  }
}
