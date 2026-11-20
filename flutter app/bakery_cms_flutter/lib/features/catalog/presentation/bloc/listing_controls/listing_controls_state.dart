import 'package:equatable/equatable.dart';

import '../../../domain/entities/listing_filter.dart';
import '../../../domain/entities/listing_sort.dart';

class ListingControlsState extends Equatable {
  const ListingControlsState({
    this.sort = ListingSort.popularity,
    this.filter = const ListingFilter(),
  });

  final ListingSort sort;
  final ListingFilter filter;

  ListingControlsState copyWith({ListingSort? sort, ListingFilter? filter}) {
    return ListingControlsState(sort: sort ?? this.sort, filter: filter ?? this.filter);
  }

  @override
  List<Object?> get props => [sort, filter];
}
