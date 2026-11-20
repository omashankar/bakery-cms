import 'package:equatable/equatable.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../../home_layout/domain/entities/home_banner.dart';
import '../../../domain/entities/catalog.dart';

class CategoriesState extends Equatable {
  const CategoriesState({
    this.status = ViewStatus.initial,
    this.catalog = const Catalog(),
    this.promo,
    this.errorMessage,
  });

  final ViewStatus status;
  final Catalog catalog;

  /// A promo picture from the home page, when the app already holds it.
  final HomeBanner? promo;
  final String? errorMessage;

  bool get isEmpty => catalog.isEmpty;

  CategoriesState copyWith({ViewStatus? status, Catalog? catalog, String? errorMessage}) {
    return CategoriesState(
      status: status ?? this.status,
      catalog: catalog ?? this.catalog,
      promo: promo,
      errorMessage: errorMessage,
    );
  }

  /// A fresh read of the promo, which may now be gone.
  CategoriesState withPromo(HomeBanner? promo) =>
      CategoriesState(status: status, catalog: catalog, promo: promo, errorMessage: errorMessage);

  @override
  List<Object?> get props => [status, catalog, promo, errorMessage];
}
