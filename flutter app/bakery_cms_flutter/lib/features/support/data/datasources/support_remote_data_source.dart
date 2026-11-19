import '../models/faq_item_model.dart';
import '../models/inquiry_request_model.dart';
import '../models/shop_contact_model.dart';
import '../models/shop_page_model.dart';

abstract interface class SupportRemoteDataSource {
  Future<ShopContactModel> fetchContact();

  Future<List<FaqItemModel>> fetchFaqs();

  Future<ShopPageModel> fetchPage(String slug);

  Future<void> sendInquiry(InquiryRequestModel request);
}
