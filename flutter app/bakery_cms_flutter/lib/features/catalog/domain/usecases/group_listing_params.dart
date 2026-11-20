import 'package:equatable/equatable.dart';

import '../entities/group_kind.dart';

class GroupListingParams extends Equatable {
  const GroupListingParams({required this.kind, required this.slug, this.forceRefresh = false});

  final GroupKind kind;
  final String slug;
  final bool forceRefresh;

  @override
  List<Object?> get props => [kind, slug, forceRefresh];
}
