import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/group_kind.dart';
import '../../../domain/usecases/get_group_listing.dart';
import '../../../domain/usecases/group_listing_params.dart';
import 'product_list_state.dart';

/// One category, occasion or collection page.
class ProductListCubit extends Cubit<ProductListState> {
  ProductListCubit(this._getGroupListing) : super(const ProductListState());

  final GetGroupListing _getGroupListing;

  GroupListingParams? _params;

  Future<void> load(GroupKind kind, String slug) {
    _params = GroupListingParams(kind: kind, slug: slug);
    return _fetch(_params!);
  }

  Future<void> refresh() async {
    final params = _params;
    if (params == null) return;
    await _fetch(GroupListingParams(kind: params.kind, slug: params.slug, forceRefresh: true));
  }

  Future<void> _fetch(GroupListingParams params) async {
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _getGroupListing(params);
    if (isClosed) return; // the screen was left mid-request
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (listing) => emit(state.copyWith(status: ViewStatus.success, listing: listing)),
    );
  }
}
