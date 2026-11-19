import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/delivery_area_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/date_formatter.dart';
import '../../../checkout/domain/services/shop_clock.dart';
import '../../../store/domain/entities/store_config.dart';
import '../../../store/presentation/bloc/store_config_cubit.dart';
import '../../domain/entities/earliest_delivery.dart';
import '../../domain/services/earliest_delivery_service.dart';
import '../bloc/delivery_area_cubit.dart';

/// "Earliest delivery: Today" / "Tomorrow" / "22 Nov".
///
/// From the shop's settings (lead days, same-day cutoff, timezone, via the
/// app-wide `StoreConfigCubit`) and the chosen area's own preparation days
/// (the app-wide `DeliveryAreaCubit`), by the rule checkout's date list uses.
/// Draws nothing until the settings are in, or when the shop does not
/// deliver to the chosen PIN code. [style] defaults to `bodySmall`.
class EarliestDeliveryText extends StatelessWidget {
  const EarliestDeliveryText({super.key, this.style});

  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final config = context.select<StoreConfigCubit, StoreConfig?>((cubit) => cubit.state.config);
    final area = context.select<DeliveryAreaCubit, ({bool notDelivered, int? minDays})>(
      (cubit) => (notDelivered: cubit.state.isNotDelivered, minDays: cubit.state.minDeliveryDays),
    );
    if (config == null || area.notDelivered) return const SizedBox.shrink();

    final earliest = EarliestDeliveryService(ShopClock(config.timezone)).earliest(
      leadDays: config.deliveryLeadDays,
      sameDayCutoff: config.sameDayCutoff,
      minDeliveryDays: area.minDays,
    );
    return Text(
      '${DeliveryAreaStrings.earliestDelivery}${DeliveryAreaStrings.labelSeparator}'
      '${_day(earliest)}',
      style: style ?? context.text.bodySmall,
    );
  }

  static String _day(EarliestDelivery earliest) {
    if (earliest.isToday) return DeliveryAreaStrings.today;
    if (earliest.isTomorrow) return DeliveryAreaStrings.tomorrow;
    return DateFormatter.shortDay(earliest.date);
  }
}
