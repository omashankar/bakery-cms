import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/entities/listing_filter.dart';
import '../../../domain/entities/price_band.dart';

/// The ticks in an open filter sheet, before Apply. Starts from the filter
/// already applied; closing the sheet without Apply changes nothing.
class FilterDraftCubit extends Cubit<ListingFilter> {
  FilterDraftCubit(super.initial);

  void toggleBand(PriceBand band) => emit(state.toggleBand(band));

  void toggleInStock() => emit(state.copyWith(inStockOnly: !state.inStockOnly));

  void toggleFourStars() => emit(state.copyWith(fourStarAndAbove: !state.fourStarAndAbove));
}
