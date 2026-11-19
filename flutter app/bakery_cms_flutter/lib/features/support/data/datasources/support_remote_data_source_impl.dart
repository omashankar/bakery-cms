import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/faq_item_model.dart';
import '../models/inquiry_request_model.dart';
import '../models/shop_contact_model.dart';
import '../models/shop_page_model.dart';
import 'support_remote_data_source.dart';

class SupportRemoteDataSourceImpl implements SupportRemoteDataSource {
  const SupportRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  /// Public, read-only. The contact block is the website's own read
  /// (`getStorefrontContact`), not the raw settings.
  static const String contactPath = '/api/storefront/contact';

  /// Public: a visitor is sent the published FAQs only.
  static const String faqPath = '/api/content/faq';

  /// Public: the contact and wedding forms post here.
  static const String inquiriesPath = '/api/inquiries';

  /// Public, read-only, published pages only (`/api/pages` is admin-only).
  static String pagePath(String slug) => '/api/storefront/pages/${Uri.encodeComponent(slug)}';

  @override
  Future<ShopContactModel> fetchContact() async {
    final data = await _client.get(contactPath);
    if (data is! Map<String, dynamic>) throw const ServerException();
    return ShopContactModel.fromJson(data);
  }

  @override
  Future<List<FaqItemModel>> fetchFaqs() async {
    final data = await _client.get(faqPath);
    if (data is! List) throw const ServerException();
    return data
        .whereType<Map<String, dynamic>>()
        .map(FaqItemModel.fromJson)
        .where((faq) => faq.isPublished && faq.question.trim().isNotEmpty)
        .toList();
  }

  @override
  Future<ShopPageModel> fetchPage(String slug) async {
    final data = await _client.get(pagePath(slug));
    if (data is! Map<String, dynamic>) throw const ServerException();
    return ShopPageModel.fromJson(data);
  }

  @override
  Future<void> sendInquiry(InquiryRequestModel request) async {
    await _client.post(inquiriesPath, body: request.toJson());
  }
}
