import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/features/store/data/models/public_settings_model.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_config.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_modules.dart';
import 'package:bakery_cms_flutter/features/store/domain/usecases/get_store_config.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_cubit.dart';
import 'package:bakery_cms_flutter/features/store/presentation/widgets/maintenance_gate.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockGetStoreConfig extends Mock implements GetStoreConfig {}

/// `GET /api/settings/public` → `data`, as `getPublicSettings` builds it
/// (settings.service.ts): `modules` as the shop stored them, `maintenance`
/// with its message ("" when the shop wrote none).
Map<String, dynamic> settings({Object? modules, bool closed = false, String message = ''}) => {
  'general': {'siteName': 'Sweet Crumbs Bakery', 'siteTagline': '', 'logo': '', 'currency': 'INR'},
  'commerce': {
    'deliveryFee': 99,
    'minOrderValue': 500,
    'checkoutTerms': 'I agree to the terms.',
    'cancellationPolicyText': 'Orders can be cancelled until we start baking.',
  },
  'maintenance': {'isEnabled': closed, 'message': message},
  'modules': ?modules,
};

StoreConfig parse(Map<String, dynamic> json) => PublicSettingsModel.fromJson(json).toEntity();

void main() {
  group('modules', () {
    test('a switch the shop turned off is off; the rest are on', () {
      final config = parse(
        settings(modules: {'flavour': true, 'weight': false, 'shape': true, 'photoCake': false}),
      );
      expect(config.isModuleOn(StoreModules.weight), isFalse);
      expect(config.isModuleOn(StoreModules.photoCake), isFalse);
      expect(config.isModuleOn(StoreModules.flavour), isTrue);
      expect(config.isModuleOn(StoreModules.shape), isTrue);
    });

    test('fails open, like the website: missing, absent or not a boolean is on', () {
      expect(parse(settings()).isModuleOn(StoreModules.weight), isTrue);
      expect(parse(settings(modules: {'flavour': false})).isModuleOn(StoreModules.shape), isTrue);
      expect(parse(settings(modules: {'weight': 'no'})).isModuleOn(StoreModules.weight), isTrue);
      expect(parse(settings(modules: 'broken')).modules, isEmpty);
    });
  });

  test('the minimum order, the terms and the full cancellation wording are read', () {
    final config = parse(settings());
    expect(config.minOrderValue, 500);
    expect(config.checkoutTerms, 'I agree to the terms.');
    expect(config.cancellationPolicyText, 'Orders can be cancelled until we start baking.');
  });

  test('a closed shop with no words of its own uses the website\'s default notice', () {
    expect(
      parse(settings(closed: true)).maintenanceNotice,
      'We are currently performing scheduled maintenance. Please check back shortly.',
    );
    expect(parse(settings(closed: true, message: 'Back at 6.')).maintenanceNotice, 'Back at 6.');
  });

  group('the maintenance notice replaces the app', () {
    late _MockGetStoreConfig getConfig;

    setUpAll(() => registerFallbackValue(const NoParams()));
    setUp(() => getConfig = _MockGetStoreConfig());

    Future<void> pump(WidgetTester tester, StoreConfig config) async {
      when(() => getConfig(any())).thenAnswer((_) async => Right(config));
      final cubit = StoreConfigCubit(getConfig, retryDelays: const []);
      addTearDown(cubit.close);
      await cubit.load();
      await tester.pumpWidget(
        BlocProvider.value(
          value: cubit,
          child: const MaterialApp(home: MaintenanceGate(child: Text('The shop'))),
        ),
      );
      await tester.pump();
    }

    testWidgets('closed: the website\'s screen, in the shop\'s words, and no shop', (tester) async {
      await pump(tester, parse(settings(closed: true, message: 'Back at 6 PM.')));
      expect(find.text('Sweet Crumbs Bakery is closed for maintenance'), findsOneWidget);
      expect(find.text('Back at 6 PM.'), findsOneWidget);
      expect(find.text('Please check back shortly.'), findsOneWidget);
      expect(find.text('The shop'), findsNothing);
    });

    testWidgets('open: the app as it is', (tester) async {
      await pump(tester, parse(settings()));
      expect(find.text('The shop'), findsOneWidget);
      expect(find.textContaining('closed for maintenance'), findsNothing);
    });

    testWidgets('"Check again" reads the settings again, and an open shop comes back', (
      tester,
    ) async {
      await pump(tester, parse(settings(closed: true)));
      when(() => getConfig(any())).thenAnswer((_) async => Right(parse(settings())));
      await tester.tap(find.text('Check again'));
      await tester.pump();
      await tester.pump();
      expect(find.text('The shop'), findsOneWidget);
    });
  });
}
