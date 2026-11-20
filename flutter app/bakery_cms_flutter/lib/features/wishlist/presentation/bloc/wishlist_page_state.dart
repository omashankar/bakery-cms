import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../../catalog/domain/entities/product.dart';

class WishlistPageState extends Equatable {
  const WishlistPageState({
    this.status = ViewStatus.initial,
    this.products = const [],
    this.errorMessage,
  });

  final ViewStatus status;
  final List<Product> products;
  final String? errorMessage;

  bool get isEmpty => products.isEmpty;

  WishlistPageState copyWith({ViewStatus? status, List<Product>? products, String? errorMessage}) {
    return WishlistPageState(
      status: status ?? this.status,
      products: products ?? this.products,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, products, errorMessage];
}
