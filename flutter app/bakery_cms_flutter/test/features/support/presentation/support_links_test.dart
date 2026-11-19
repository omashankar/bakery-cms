import 'package:bakery_cms_flutter/app/router/app_routes.dart';
import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/support_strings.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/avatar_cubit.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/avatar_state.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/delete_account_cubit.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/delete_account_state.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/profile_cubit.dart';
import 'package:bakery_cms_flutter/features/account/presentation/bloc/profile_state.dart';
import 'package:bakery_cms_flutter/features/account/presentation/pages/account_page.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_event.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_state.dart';
import 'package:bakery_cms_flutter/features/support/presentation/widgets/legal_links_line.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../auth/auth_fixtures.dart';

class _MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

class _MockProfileCubit extends MockCubit<ProfileState> implements ProfileCubit {}

class _MockAvatarCubit extends MockCubit<AvatarState> implements AvatarCubit {}

class _MockDeleteAccountCubit extends MockCubit<DeleteAccountState> implements DeleteAccountCubit {}

/// Account and the sign-in terms line lead to Contact, the FAQ, and the
/// Privacy Policy and Terms of Service (the Play Store asks for both to be
/// reachable in the app). Each link is followed to the route it names.
void main() {
  late _MockAuthBloc auth;

  setUp(() {
    auth = _MockAuthBloc();
    whenListen(
      auth,
      const Stream<AuthState>.empty(),
      initialState: const AuthState.authenticated(testCustomer),
    );
    final profile = _MockProfileCubit();
    whenListen(profile, const Stream<ProfileState>.empty(), initialState: const ProfileState());
    final deleting = _MockDeleteAccountCubit();
    whenListen(
      deleting,
      const Stream<DeleteAccountState>.empty(),
      initialState: const DeleteAccountState(status: ViewStatus.initial),
    );
    final avatar = _MockAvatarCubit();
    whenListen(avatar, const Stream<AvatarState>.empty(), initialState: const AvatarState());
    GetIt.I
      ..registerFactory<AvatarCubit>(() => avatar)
      ..registerFactory<ProfileCubit>(() => profile)
      ..registerFactory<DeleteAccountCubit>(() => deleting);
  });

  tearDown(() => GetIt.I.reset());

  Future<void> pumpAt(WidgetTester tester, Widget start) async {
    // A tall phone, so a tap lands on what it names rather than off the edge.
    tester.view
      ..physicalSize = const Size(800, 2400)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    Widget landed(GoRouterState state) => Scaffold(body: Text('AT ${state.uri}'));
    final router = GoRouter(
      initialLocation: '/start',
      routes: [
        GoRoute(path: '/start', builder: (_, _) => start),
        GoRoute(path: AppRoutes.contact, builder: (_, state) => landed(state)),
        GoRoute(path: AppRoutes.faq, builder: (_, state) => landed(state)),
        GoRoute(path: AppRoutes.pagePattern, builder: (_, state) => landed(state)),
      ],
    );
    await tester.pumpWidget(
      BlocProvider<AuthBloc>.value(
        value: auth,
        child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  const accountLinks = {
    SupportStrings.contactTile: '/contact',
    SupportStrings.faqTile: '/faq',
    SupportStrings.privacyTile: '/pages/privacy',
    SupportStrings.termsTile: '/pages/terms',
  };

  for (final MapEntry(key: label, value: route) in accountLinks.entries) {
    testWidgets('Account → $label opens $route', (tester) async {
      await pumpAt(tester, const AccountPage());

      await tester.ensureVisible(find.text(label));
      await tester.pumpAndSettle();
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();

      expect(find.text('AT $route'), findsOneWidget);
    });
  }

  const loginLinks = {
    SupportStrings.termsTile: '/pages/terms',
    SupportStrings.privacyTile: '/pages/privacy',
  };

  for (final MapEntry(key: label, value: route) in loginLinks.entries) {
    testWidgets('the sign-in terms line → $label opens $route', (tester) async {
      await pumpAt(tester, const Scaffold(body: Center(child: LegalLinksLine())));

      await tester.tap(find.text(label));
      await tester.pumpAndSettle();

      expect(find.text('AT $route'), findsOneWidget);
    });
  }
}
