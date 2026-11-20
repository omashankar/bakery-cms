import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/faq_item.dart';
import '../repositories/support_repository.dart';

class GetFaqs implements UseCase<List<FaqItem>, NoParams> {
  const GetFaqs(this._repository);

  final SupportRepository _repository;

  @override
  Future<Either<Failure, List<FaqItem>>> call(NoParams params) => _repository.getFaqs();
}
