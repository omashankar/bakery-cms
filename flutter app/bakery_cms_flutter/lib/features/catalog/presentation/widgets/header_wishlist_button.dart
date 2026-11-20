import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/strings/wishlist_strings.dart';
import '../../../wishlist/presentation/bloc/wishlist_cubit.dart';
import '../../../wishlist/presentation/bloc/wishlist_state.dart';

/// The wishlist in a page's header, with how many products are saved.
class HeaderWishlistButton extends StatelessWidget {
  const HeaderWishlistButton({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocSelector<WishlistCubit, WishlistState, int>(
      selector: (state) => state.slugs.length,
      builder: (context, count) => IconButton(
        tooltip: WishlistStrings.title,
        onPressed: () => context.push(AppRoutes.wishlist),
        icon: Badge(
          isLabelVisible: count > 0,
          label: Text('$count'),
          child: const Icon(Icons.favorite_border),
        ),
      ),
    );
  }
}
