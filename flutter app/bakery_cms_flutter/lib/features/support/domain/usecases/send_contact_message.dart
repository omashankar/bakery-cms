import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/contact_message.dart';
import '../repositories/support_repository.dart';

class SendContactMessage implements UseCase<Unit, ContactMessage> {
  const SendContactMessage(this._repository);

  final SupportRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(ContactMessage message) => _repository.sendMessage(message);
}
