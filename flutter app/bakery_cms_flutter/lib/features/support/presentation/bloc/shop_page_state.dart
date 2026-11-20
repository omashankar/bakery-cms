import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/shop_page.dart';

class ShopPageState extends Equatable {
  const ShopPageState({
    this.status = ViewStatus.initial,
    this.page,
    this.notFound = false,
    this.errorMessage,
  });

  final ViewStatus status;
  final ShopPage? page;

  /// The shop answered 404: the page is a draft or does not exist. Not a
  /// failure to retry, so the screen says so instead of "try again".
  final bool notFound;
  final String? errorMessage;

  ShopPageState copyWith({
    ViewStatus? status,
    ShopPage? page,
    bool? notFound,
    String? errorMessage,
  }) {
    return ShopPageState(
      status: status ?? this.status,
      page: page ?? this.page,
      notFound: notFound ?? this.notFound,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, page, notFound, errorMessage];
}
