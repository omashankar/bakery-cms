import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/quote.dart';
import '../entities/quote_request.dart';
import '../repositories/checkout_repository.dart';

/// The running total while the customer fills the form. The request carries
/// no full address, so no map pin is needed yet.
class EstimateQuote implements UseCase<Quote, QuoteRequest> {
  const EstimateQuote(this._repository);

  final CheckoutRepository _repository;

  @override
  Future<Either<Failure, Quote>> call(QuoteRequest params) => _repository.quote(params);
}
