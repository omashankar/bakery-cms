import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/constants/strings/auth_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/content_width.dart';
import '../../../support/presentation/widgets/legal_links_line.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_state.dart';
import '../bloc/auth_status.dart';
import '../bloc/login_bloc.dart';
import '../bloc/login_state.dart';
import '../bloc/login_step.dart';
import '../widgets/code_step_form.dart';
import '../widgets/email_step_form.dart';
import '../../../catalog/presentation/widgets/shop_title.dart';

/// Sign in with an emailed code.
///
/// Once signed in it goes on to [redirectTo] itself. The router's redirect
/// cannot always do it: Cart → Checkout PUSHES the sign-in page over /cart, so
/// the address the router sees never changes and the customer was left on this
/// page with the button spinning.
class LoginPage extends StatelessWidget {
  const LoginPage({super.key, this.redirectTo});

  /// Where to go after signing in. Only an in-app path is honoured.
  final String? redirectTo;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.I<LoginBloc>(),
      child: _LoginView(
        destination: (redirectTo != null && redirectTo!.startsWith('/'))
            ? redirectTo!
            : AppRoutes.home,
      ),
    );
  }
}

class _LoginView extends StatelessWidget {
  const _LoginView({required this.destination});

  final String destination;

  /// Back (or ×) from a sign-in page that is the only page on the stack (a
  /// signed-out tap on Orders or Account replaces the screen with it) goes
  /// home, instead of closing the app.
  void _leave(BuildContext context) =>
      context.canPop() ? context.pop() : context.go(AppRoutes.home);

  void _signedIn(BuildContext context) {
    AppSnackbar.success(context, AuthStrings.signedIn);
    if (context.canPop()) {
      context.pushReplacement(destination);
    } else {
      context.go(destination);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocListener(
      listeners: [
        BlocListener<LoginBloc, LoginState>(
          listenWhen: (previous, current) =>
              (current.status != previous.status &&
                  current.status.isFailure &&
                  current.errorMessage != null) ||
              (current.codeResent && !previous.codeResent),
          listener: (context, state) => state.status.isFailure
              ? AppSnackbar.error(context, state.errorMessage!)
              : AppSnackbar.success(context, AuthStrings.codeSent),
        ),
        BlocListener<AuthBloc, AuthState>(
          listenWhen: (previous, current) =>
              previous.status != AuthStatus.authenticated &&
              current.status == AuthStatus.authenticated,
          listener: (context, _) => _signedIn(context),
        ),
      ],
      child: PopScope(
        canPop: context.canPop(),
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) context.go(AppRoutes.home);
        },
        child: Scaffold(
          // The shop's brand, as on every page: the heading below already says
          // "Sign in or create an account", so the bar does not say it twice.
          appBar: AppAppBar(
            titleWidget: const ShopTitle(),
            leading: IconButton(
              tooltip: AppStrings.close,
              icon: const Icon(Icons.close),
              onPressed: () => _leave(context),
            ),
          ),
          body: SafeArea(
            child: ContentWidth(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    BlocSelector<LoginBloc, LoginState, LoginStep>(
                      selector: (state) => state.step,
                      builder: (context, step) => switch (step) {
                        LoginStep.email => const EmailStepForm(),
                        LoginStep.code => const CodeStepForm(),
                      },
                    ),
                    // Under both steps, as on the website's sign-in dialog.
                    const SizedBox(height: AppSpacing.xl),
                    const LegalLinksLine(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
