import 'package:flutter/foundation.dart';
import 'package:fpdart/fpdart.dart';

import 'cache_exception.dart';
import 'cache_failure.dart';
import 'failure.dart';
import 'network_exception.dart';
import 'network_failure.dart';
import 'server_exception.dart';
import 'server_failure.dart';
import 'unauthorized_exception.dart';
import 'unauthorized_failure.dart';
import 'unknown_failure.dart';

/// Runs a data-layer call and converts every typed exception into a [Failure].
///
/// Every repository method goes through this, so the exception → failure
/// mapping is written once instead of as a try/catch in each repository.
Future<Either<Failure, T>> guard<T>(Future<T> Function() body) async {
  try {
    return Right(await body());
  } on UnauthorizedException {
    return const Left(UnauthorizedFailure());
  } on NetworkException catch (e) {
    return Left(NetworkFailure(isTimeout: e.isTimeout));
  } on ServerException catch (e) {
    return Left(ServerFailure(e.message, e.field, e.statusCode));
  } on CacheException {
    return const Left(CacheFailure());
  } catch (error, stack) {
    // A bug or an unexpected payload — logged for us, never shown verbatim.
    debugPrint('Unexpected repository error: $error\n$stack');
    return const Left(UnknownFailure());
  }
}
