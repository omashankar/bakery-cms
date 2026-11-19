import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/widgets/price_text.dart';
import '../bloc/store_config_cubit.dart';
import '../bloc/store_config_state.dart';

/// A [PriceText] in the shop's own currency. Rebuilds only if the currency
/// changes, not on every settings update.
class ShopPrice extends StatelessWidget {
  const ShopPrice({
    super.key,
    required this.amount,
    this.compareAt,
    this.style,
    this.showPercentOff = false,
  });

  static const String fallbackCurrency = 'INR';

  final num amount;
  final num? compareAt;
  final TextStyle? style;
  final bool showPercentOff;

  @override
  Widget build(BuildContext context) {
    return BlocSelector<StoreConfigCubit, StoreConfigState, String>(
      selector: (state) => state.config?.currency ?? fallbackCurrency,
      builder: (context, currency) => PriceText(
        amount: amount,
        compareAt: compareAt,
        currency: currency,
        style: style,
        showPercentOff: showPercentOff,
      ),
    );
  }
}
