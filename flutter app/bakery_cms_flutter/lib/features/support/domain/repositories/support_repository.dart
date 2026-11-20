import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/contact_message.dart';
import '../entities/faq_item.dart';
import '../entities/shop_contact.dart';
import '../entities/shop_page.dart';

/// The shop's public help: how to reach it, its FAQs, its published pages,
/// and the contact form. Nothing here needs a sign-in.
abstract interface class SupportRepository {
  Future<Either<Failure, ShopContact>> getContact();

  /// Published FAQs only.
  Future<Either<Failure, List<FaqItem>>> getFaqs();

  /// A published page. A draft or unknown slug fails with a 404
  /// `ServerFailure`, as the website answers 404.
  Future<Either<Failure, ShopPage>> getPage(String slug);

  Future<Either<Failure, Unit>> sendMessage(ContactMessage message);
}
