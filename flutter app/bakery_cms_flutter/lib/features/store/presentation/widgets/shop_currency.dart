import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bloc/store_config_cubit.dart';
import 'shop_price.dart';

/// The shop's currency code, for formatting a money string outside a
/// [ShopPrice] (e.g. inside a button label).
extension ShopCurrency on BuildContext {
  String get shopCurrency => select<StoreConfigCubit, String>(
    (cubit) => cubit.state.config?.currency ?? ShopPrice.fallbackCurrency,
  );
}
