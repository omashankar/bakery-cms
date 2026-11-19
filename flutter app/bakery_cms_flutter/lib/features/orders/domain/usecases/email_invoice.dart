import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/orders_repository.dart';
import 'email_invoice_params.dart';

/// "Email invoice": `POST /api/orders/by-number/{n}/email-invoice?email=…`,
/// as the website's invoice page calls it (`emailInvoiceRequest`). Answers
/// the address the shop mailed.
class EmailInvoice implements UseCase<String, EmailInvoiceParams> {
  const EmailInvoice(this._repository);

  final OrdersRepository _repository;

  @override
  Future<Either<Failure, String>> call(EmailInvoiceParams params) =>
      _repository.emailInvoice(params.orderNumber, email: params.email);
}
