import 'package:equatable/equatable.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/group_listing.dart';

class ProductListState extends Equatable {
  const ProductListState({this.status = ViewStatus.initial, this.listing, this.errorMessage});

  final ViewStatus status;
  final GroupListing? listing;
  final String? errorMessage;

  bool get isEmpty => listing?.products.isEmpty ?? true;

  ProductListState copyWith({ViewStatus? status, GroupListing? listing, String? errorMessage}) {
    return ProductListState(
      status: status ?? this.status,
      listing: listing ?? this.listing,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, listing, errorMessage];
}
