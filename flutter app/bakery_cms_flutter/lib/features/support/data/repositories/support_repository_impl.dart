import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../domain/entities/contact_message.dart';
import '../../domain/entities/faq_item.dart';
import '../../domain/entities/shop_contact.dart';
import '../../domain/entities/shop_page.dart';
import '../../domain/repositories/support_repository.dart';
import '../datasources/support_remote_data_source.dart';
import '../models/inquiry_request_model.dart';

class SupportRepositoryImpl implements SupportRepository {
  const SupportRepositoryImpl(this._remote);

  final SupportRemoteDataSource _remote;

  @override
  Future<Either<Failure, ShopContact>> getContact() =>
      guard(() async => (await _remote.fetchContact()).toEntity());

  @override
  Future<Either<Failure, List<FaqItem>>> getFaqs() => guard(() async {
    final faqs = (await _remote.fetchFaqs()).map((model) => model.toEntity()).toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return faqs;
  });

  @override
  Future<Either<Failure, ShopPage>> getPage(String slug) =>
      guard(() async => (await _remote.fetchPage(slug)).toEntity());

  @override
  Future<Either<Failure, Unit>> sendMessage(ContactMessage message) => guard(() async {
    await _remote.sendInquiry(InquiryRequestModel.fromEntity(message));
    return unit;
  });
}
