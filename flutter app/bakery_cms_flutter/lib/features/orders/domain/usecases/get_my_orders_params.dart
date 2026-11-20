import 'package:equatable/equatable.dart';

class GetMyOrdersParams extends Equatable {
  const GetMyOrdersParams({this.forceRefresh = false});

  final bool forceRefresh;

  @override
  List<Object?> get props => [forceRefresh];
}
