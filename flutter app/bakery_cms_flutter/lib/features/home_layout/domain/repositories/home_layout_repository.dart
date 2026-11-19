import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/home_layout.dart';

abstract interface class HomeLayoutRepository {
  /// The published home page. Kept in memory once read; [forceRefresh] asks
  /// the shop again.
  Future<Either<Failure, HomeLayout>> getHomeLayout({bool forceRefresh = false});

  /// The page already read, or null when none has been yet. Never asks the
  /// shop: for screens that use the layout only if it is to hand.
  HomeLayout? get cached;
}
