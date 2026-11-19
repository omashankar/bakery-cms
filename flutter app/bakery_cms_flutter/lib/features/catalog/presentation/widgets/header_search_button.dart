import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/strings/catalog_strings.dart';

/// Search, from a page's header, for screens without the home's search box.
class HeaderSearchButton extends StatelessWidget {
  const HeaderSearchButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: CatalogStrings.searchTitle,
      onPressed: () => context.push(AppRoutes.search),
      icon: const Icon(Icons.search),
    );
  }
}
