import 'package:equatable/equatable.dart';

import 'page_block_type.dart';

class PageBlock extends Equatable {
  const PageBlock({required this.id, required this.type, required this.content});

  final String id;
  final PageBlockType type;
  final String content;

  @override
  List<Object?> get props => [id, type, content];
}
