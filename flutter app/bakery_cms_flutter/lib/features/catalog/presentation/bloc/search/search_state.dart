import 'package:equatable/equatable.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/product.dart';

class SearchState extends Equatable {
  const SearchState({
    this.status = ViewStatus.initial,
    this.query = '',
    this.results = const [],
    this.errorMessage,
  });

  final ViewStatus status;
  final String query;
  final List<Product> results;
  final String? errorMessage;

  bool get hasQuery => query.trim().isNotEmpty;

  SearchState copyWith({
    ViewStatus? status,
    String? query,
    List<Product>? results,
    String? errorMessage,
  }) {
    return SearchState(
      status: status ?? this.status,
      query: query ?? this.query,
      results: results ?? this.results,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, query, results, errorMessage];
}
