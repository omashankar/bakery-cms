import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/constants/strings/product_page_strings.dart';
import '../../../../core/constants/strings/questions_strings.dart';
import '../../../../core/constants/strings/reviews_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/content_width.dart';
import '../../../../core/widgets/state_view.dart';
import '../../../cart/presentation/bloc/cart_cubit.dart';
import '../../../cart/presentation/bloc/cart_state.dart';
import '../../../offers/presentation/bloc/offers_cubit.dart';
import '../../../offers/presentation/widgets/product_offers.dart';
import '../../../product_questions/presentation/bloc/questions/product_questions_cubit.dart';
import '../../../product_questions/presentation/widgets/product_questions_section.dart';
import '../../../reviews/presentation/bloc/reviews/reviews_cubit.dart';
import '../../../reviews/presentation/widgets/product_reviews_section.dart';
import '../../../store/presentation/bloc/store_config_cubit.dart';
import '../../../store/presentation/bloc/store_config_state.dart';
import '../../../store/presentation/widgets/shop_currency.dart';
import '../../domain/entities/photo_frame_shape.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/product_selection.dart';
import '../bloc/cake_photo/cake_photo_cubit.dart';
import '../bloc/cake_photo/cake_photo_state.dart';
import '../bloc/product_detail/product_detail_cubit.dart';
import '../bloc/product_detail/product_detail_state.dart';
import '../utils/product_modules_reader.dart';
import '../widgets/add_to_cart_bar.dart';
import '../widgets/cake_message_field.dart';
import '../widgets/cake_photo_picker.dart';
import '../widgets/load_when_near.dart';
import '../widgets/product_delivery_panel.dart';
import '../widgets/product_description.dart';
import '../widgets/product_gallery.dart';
import '../widgets/product_options.dart';
import '../widgets/product_quantity_row.dart';
import '../widgets/product_section.dart';
import '../widgets/product_summary.dart';
import '../widgets/related_products_rail.dart';
import '../widgets/header_cart_button.dart';
import '../widgets/header_search_button.dart';
import '../widgets/header_wishlist_button.dart';
import '../widgets/shop_title.dart';

class ProductDetailPage extends StatelessWidget {
  const ProductDetailPage({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (context) => GetIt.I<ProductDetailCubit>()
            ..load(
              slug,
              modules: ProductModulesReader.of(context.read<StoreConfigCubit>().state.config),
            ),
        ),
        // Page-scoped: a photo picked here belongs to this visit only.
        BlocProvider(create: (_) => GetIt.I<CakePhotoCubit>()),
        // Below the fold: each asks the shop only when its block nears the
        // screen, never before the page's first paint.
        BlocProvider(create: (_) => GetIt.I<ReviewsCubit>()),
        BlocProvider(create: (_) => GetIt.I<ProductQuestionsCubit>()),
        BlocProvider(create: (_) => GetIt.I<OffersCubit>()),
      ],
      child: _ProductDetailView(slug: slug),
    );
  }
}

class _ProductDetailView extends StatelessWidget {
  const _ProductDetailView({required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context) {
    return MultiBlocListener(
      listeners: [
        BlocListener<CartCubit, CartState>(
          listenWhen: (previous, current) =>
              current.lastAddedName != null && previous.cart != current.cart,
          listener: (context, state) {
            // The router, not this page: the tap can come after the page closed.
            final router = GoRouter.of(context);
            AppSnackbar.success(
              context,
              '${state.lastAddedName} ${CatalogStrings.addedToCart}',
              actionLabel: CatalogStrings.viewCart,
              onAction: () => router.go(AppRoutes.cart),
            );
          },
        ),
        BlocListener<CakePhotoCubit, CakePhotoState>(
          listener: (context, photo) {
            // The upload decides what the cart line carries.
            context.read<ProductDetailCubit>().setPhoto(photo.url, pending: photo.isPending);
            final notice = photo.errorMessage;
            if (notice != null && !photo.status.isFailure) AppSnackbar.error(context, notice);
          },
        ),
        // The shop's modules decide what is offered and charged; follow them
        // when the settings arrive or change.
        BlocListener<StoreConfigCubit, StoreConfigState>(
          listenWhen: (previous, current) => previous.config != current.config,
          listener: (context, state) =>
              context.read<ProductDetailCubit>().setModules(ProductModulesReader.of(state.config)),
        ),
        // The offers are read once the product is drawn, never before it.
        BlocListener<ProductDetailCubit, ProductDetailState>(
          listenWhen: (previous, current) => !previous.status.isSuccess && current.status.isSuccess,
          listener: (context, _) => context.read<OffersCubit>().load(),
        ),
      ],
      child: BlocBuilder<ProductDetailCubit, ProductDetailState>(
        builder: (context, state) {
          final selection = state.selection;
          return Scaffold(
            appBar: const AppAppBar(
              titleWidget: ShopTitle(),
              actions: [HeaderSearchButton(), HeaderWishlistButton(), HeaderCartButton()],
            ),
            bottomNavigationBar: selection == null
                ? null
                : AddToCartBar(selection: selection, photoPending: state.photoPending),
            body: StateView(
              status: state.status,
              isEmpty: selection == null,
              errorMessage: state.errorMessage,
              onRetry: () => context.read<ProductDetailCubit>().load(slug),
              builder: (_) => _ProductBody(selection: selection!, related: state.related),
            ),
          );
        },
      ),
    );
  }
}

/// Top to bottom: the photos with the heart; name, rating, price and the
/// delivery strip; the choices and quantity; the shop's offers; the details;
/// ratings and reviews; questions and answers; "You may also like" — the
/// website's order. Each block after the first is its own [ProductSection].
class _ProductBody extends StatelessWidget {
  const _ProductBody({required this.selection, required this.related});

  final ProductSelection selection;
  final List<Product> related;

  @override
  Widget build(BuildContext context) {
    final product = selection.product;
    final choices = <Widget>[
      ProductOptions(selection: selection),
      ProductQuantityRow(quantity: selection.quantity),
      if (product.allowsMessage) const CakeMessageField(),
      if (selection.offersPhoto)
        CakePhotoPicker(shape: PhotoFrameShape.fromId(product.photoFrameShape)),
    ];
    final freeDeliveryOver = context.select<StoreConfigCubit, double>(
      (cubit) => cubit.state.config?.freeDeliveryThreshold ?? 0,
    );
    return SingleChildScrollView(
      child: ContentWidth(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ProductGallery(images: product.images, productSlug: product.slug),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ProductSummary(selection: selection),
                  const SizedBox(height: AppSpacing.lg),
                  const ProductDeliveryPanel(),
                ],
              ),
            ),
            ProductSection(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (index, choice) in choices.indexed) ...[
                    if (index > 0) const SizedBox(height: AppSpacing.lg),
                    choice,
                  ],
                ],
              ),
            ),
            ProductOffers(
              freeDeliveryThreshold: freeDeliveryOver,
              currency: context.shopCurrency,
              frame: (block) => ProductSection(child: block),
            ),
            if (ProductDescription.hasContent(product))
              ProductSection(
                title: ProductPageStrings.productDetails,
                child: ProductDescription(product: product),
              ),
            ProductSection(
              title: ReviewsStrings.title,
              child: LoadWhenNear(
                onNear: () => context.read<ReviewsCubit>().load(product.slug),
                child: ProductReviewsSection(
                  productSlug: product.slug,
                  productName: product.name,
                  reviewCount: product.reviewCount,
                ),
              ),
            ),
            ProductSection(
              title: QuestionsStrings.title,
              child: LoadWhenNear(
                onNear: () => context.read<ProductQuestionsCubit>().load(product.slug),
                child: ProductQuestionsSection(
                  productSlug: product.slug,
                  productName: product.name,
                ),
              ),
            ),
            if (related.isNotEmpty)
              ProductSection(
                title: ProductPageStrings.youMayAlsoLike,
                padded: false,
                child: RelatedProductsRail(products: related),
              ),
          ],
        ),
      ),
    );
  }
}
