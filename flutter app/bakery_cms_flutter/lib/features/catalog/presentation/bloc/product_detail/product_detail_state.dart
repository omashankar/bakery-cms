import 'package:equatable/equatable.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/product.dart';
import '../../../domain/entities/product_selection.dart';

class ProductDetailState extends Equatable {
  const ProductDetailState({
    this.status = ViewStatus.initial,
    this.selection,
    this.errorMessage,
    this.photoPending = false,
    this.related = const [],
  });

  final ViewStatus status;

  /// The product and the customer's choices; null until it has loaded.
  final ProductSelection? selection;
  final String? errorMessage;

  /// A photo was picked but is still uploading, or failed: the cake cannot go
  /// into the cart until it is there or the customer removes it.
  final bool photoPending;

  /// "You may also like": others from the same category, from the cached
  /// catalog. Empty until the product is in, and when there are none.
  final List<Product> related;

  ProductDetailState copyWith({
    ViewStatus? status,
    ProductSelection? selection,
    String? errorMessage,
    bool? photoPending,
    List<Product>? related,
  }) {
    return ProductDetailState(
      status: status ?? this.status,
      selection: selection ?? this.selection,
      errorMessage: errorMessage,
      photoPending: photoPending ?? this.photoPending,
      related: related ?? this.related,
    );
  }

  @override
  List<Object?> get props => [status, selection, errorMessage, photoPending, related];
}
