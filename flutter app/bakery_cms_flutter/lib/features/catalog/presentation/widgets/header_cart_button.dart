import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../cart/presentation/bloc/cart_cubit.dart';
import '../../../cart/presentation/bloc/cart_state.dart';

/// The cart in a page's header, with its item count: the same bag and badge
/// as the bottom bar, for the screens opened over it (a product, a list).
class HeaderCartButton extends StatelessWidget {
  const HeaderCartButton({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocSelector<CartCubit, CartState, int>(
      selector: (state) => state.cart.itemCount,
      builder: (context, count) => IconButton(
        tooltip: AppStrings.navCart,
        onPressed: () => context.go(AppRoutes.cart),
        icon: Badge(
          isLabelVisible: count > 0,
          label: Text('$count'),
          child: const Icon(Icons.shopping_bag_outlined),
        ),
      ),
    );
  }
}
