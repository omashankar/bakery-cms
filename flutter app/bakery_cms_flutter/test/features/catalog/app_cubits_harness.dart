import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_cubit.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_state.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_config.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_cubit.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_state.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mocktail/mocktail.dart';

import '../checkout/checkout_fixtures.dart' as checkout;

class MockStoreConfigCubit extends MockCubit<StoreConfigState> implements StoreConfigCubit {}

class MockWishlistCubit extends MockCubit<WishlistState> implements WishlistCubit {}

class MockDeliveryAreaCubit extends MockCubit<DeliveryAreaState> implements DeliveryAreaCubit {}

/// The app-wide cubits a product card reads (the shop's settings, the
/// wishlist, the delivery PIN code), as stubs made INSIDE the widget tree: a
/// cubit made in setUp lives outside the test's fake-async zone.
///
/// [settingsLoaded] false is the moment before the shop's settings arrive.
/// [settings] replaces the shop's settings (a shop with a module off).
Widget withAppCubits(
  Widget child, {
  bool settingsLoaded = true,
  StoreConfig? settings,
  List<String> saved = const [],
}) {
  final StoreConfig? config = settingsLoaded ? (settings ?? checkout.config) : null;
  return MultiBlocProvider(
    providers: [
      BlocProvider<StoreConfigCubit>(
        create: (_) {
          final store = MockStoreConfigCubit();
          when(() => store.state).thenReturn(
            StoreConfigState(
              status: config == null ? ViewStatus.initial : ViewStatus.success,
              config: config,
            ),
          );
          return store;
        },
      ),
      BlocProvider<WishlistCubit>(
        create: (_) {
          final wishlist = MockWishlistCubit();
          when(() => wishlist.state).thenReturn(WishlistState(slugs: saved));
          when(() => wishlist.toggle(any())).thenAnswer((_) async {});
          return wishlist;
        },
      ),
      BlocProvider<DeliveryAreaCubit>(
        create: (_) {
          final area = MockDeliveryAreaCubit();
          when(() => area.state).thenReturn(const DeliveryAreaState());
          return area;
        },
      ),
    ],
    child: child,
  );
}
