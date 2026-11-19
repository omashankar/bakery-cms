import 'package:get_it/get_it.dart';

import 'data/datasources/support_remote_data_source.dart';
import 'data/datasources/support_remote_data_source_impl.dart';
import 'data/repositories/support_repository_impl.dart';
import 'data/services/url_contact_launcher.dart';
import 'domain/repositories/support_repository.dart';
import 'domain/services/contact_launcher.dart';
import 'domain/usecases/get_faqs.dart';
import 'domain/usecases/get_shop_contact.dart';
import 'domain/usecases/get_shop_page.dart';
import 'domain/usecases/send_contact_message.dart';
import 'presentation/bloc/contact_details_cubit.dart';
import 'presentation/bloc/contact_form_cubit.dart';
import 'presentation/bloc/faq_cubit.dart';
import 'presentation/bloc/shop_page_cubit.dart';

/// Contact, FAQ and the shop's pages. Needs `ApiClient` registered first;
/// nothing here needs a sign-in.
void registerSupportFeature(GetIt sl) {
  sl
    ..registerLazySingleton<SupportRemoteDataSource>(() => SupportRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<SupportRepository>(() => SupportRepositoryImpl(sl()))
    ..registerLazySingleton<ContactLauncher>(() => const UrlContactLauncher())
    ..registerLazySingleton(() => GetShopContact(sl()))
    ..registerLazySingleton(() => GetFaqs(sl()))
    ..registerLazySingleton(() => GetShopPage(sl()))
    ..registerLazySingleton(() => SendContactMessage(sl()))
    ..registerFactory(() => ContactDetailsCubit(sl()))
    ..registerFactory(() => ContactFormCubit(sl()))
    ..registerFactory(() => FaqCubit(getFaqs: sl(), getShopContact: sl()))
    ..registerFactory(() => ShopPageCubit(sl()));
}
