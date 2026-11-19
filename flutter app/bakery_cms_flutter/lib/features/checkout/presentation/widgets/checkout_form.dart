import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_durations.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/widgets/app_dialog.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/content_width.dart';
import '../../../cart/presentation/bloc/cart_cubit.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import '../bloc/checkout_step.dart';
import '../bloc/checkout_step_cubit.dart';
import 'address_section.dart';
import 'delivery_section.dart';
import 'extras_section.dart';
import 'location_section.dart';
import 'minimum_order_alert.dart';
import 'payment_section.dart';
import 'personalise_section.dart';
import 'place_order_bar.dart';
import 'price_summary.dart';
import 'terms_section.dart';

/// The checkout screen's body: the sections, the sticky button, and the
/// listeners for refusals and success.
class CheckoutForm extends StatefulWidget {
  const CheckoutForm({super.key});

  @override
  State<CheckoutForm> createState() => _CheckoutFormState();
}

class _CheckoutFormState extends State<CheckoutForm> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  /// The consent box, scrolled to when Place order refuses over it.
  final GlobalKey _termsKey = GlobalKey();

  /// Puts the field a little below the top, with its label in view.
  static const double _scrollAlignment = 0.15;

  /// Where each step of the header begins on this one scrolling screen.
  final ScrollController _scroll = ScrollController();
  final Map<CheckoutStep, GlobalKey> _stepStarts = {
    CheckoutStep.address: GlobalKey(),
    CheckoutStep.personalise: GlobalKey(),
    CheckoutStep.payment: GlobalKey(),
  };
  StreamSubscription<CheckoutStep>? _jumps;

  /// A step is the current one once its start passes this share of the
  /// screen's height: the section the customer is reading, not the one
  /// peeking in at the bottom.
  static const double _readingLine = 0.35;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_followScroll);
    _jumps = context.read<CheckoutStepCubit>().jumps.listen(_scrollTo);
  }

  @override
  void dispose() {
    _jumps?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  /// The header's step follows what is on screen. At the very end it is
  /// Payment, however short the last sections are.
  void _followScroll() {
    final steps = context.read<CheckoutStepCubit>();
    final position = _scroll.position;
    if (position.pixels >= position.maxScrollExtent - 1 && position.maxScrollExtent > 0) {
      steps.reached(CheckoutStep.payment);
      return;
    }
    final viewport = context.findRenderObject() as RenderBox?;
    if (viewport == null) return;
    final line = viewport.localToGlobal(Offset.zero).dy + viewport.size.height * _readingLine;
    var current = CheckoutStep.address;
    for (final entry in _stepStarts.entries) {
      final start = entry.value.currentContext?.findRenderObject() as RenderBox?;
      if (start != null && start.attached && start.localToGlobal(Offset.zero).dy <= line) {
        current = entry.key;
      }
    }
    steps.reached(current);
  }

  void _scrollTo(CheckoutStep step) {
    final start = _stepStarts[step]?.currentContext;
    if (start == null) return;
    Scrollable.ensureVisible(start, duration: AppDurations.scrollToField);
  }

  void _submit() {
    FocusManager.instance.primaryFocus?.unfocus();
    final invalid = _formKey.currentState?.validateGranularly() ?? const {};
    if (invalid.isNotEmpty) {
      // The customer is at the Pay button; the field is far above. Take them
      // to the first one instead of leaving them to hunt for the red text.
      Scrollable.ensureVisible(
        invalid.first.context,
        alignment: _scrollAlignment,
        duration: AppDurations.scrollToField,
      );
      AppSnackbar.error(context, CheckoutStrings.fixHighlighted);
      return;
    }
    context.read<CheckoutBloc>().add(const CheckoutPlaceOrderPressed());
  }

  void _onPlaced(BuildContext context, CheckoutState state) {
    final cart = context.read<CartCubit>();
    context.go(AppRoutes.orderSuccess(state.confirmation!.orderNumber));
    cart.clear();
  }

  /// Paid but not confirmed: the order is (or will be) the shop's to sort
  /// out, so the cart goes, the customer is told plainly in a dialog (a
  /// snackbar vanished while the Pay button stayed live), and checkout is
  /// left for My Orders.
  Future<void> _onPaidButUnconfirmed(BuildContext context, CheckoutState state) async {
    final cart = context.read<CartCubit>();
    final router = GoRouter.of(context);
    await cart.clear();
    if (!context.mounted) return;
    await AppDialog.info(context, title: CheckoutStrings.paidTitle, message: state.paidNotice!);
    router.go(AppRoutes.orders);
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocListener(
      listeners: [
        BlocListener<CheckoutBloc, CheckoutState>(
          listenWhen: (previous, current) =>
              previous.errorId != current.errorId && current.errorMessage != null,
          listener: (context, state) {
            AppSnackbar.error(context, state.errorMessage!);
            // The refusal is about the box near the button: take them to it.
            final terms = _termsKey.currentContext;
            if (state.errorField == CheckoutBloc.termsField && terms != null) {
              Scrollable.ensureVisible(
                terms,
                alignment: _scrollAlignment,
                duration: AppDurations.scrollToField,
              );
            }
          },
        ),
        BlocListener<CheckoutBloc, CheckoutState>(
          listenWhen: (previous, current) =>
              previous.confirmation == null && current.confirmation != null,
          listener: _onPlaced,
        ),
        BlocListener<CheckoutBloc, CheckoutState>(
          listenWhen: (previous, current) => !previous.isLocked && current.isLocked,
          listener: (context, state) => _onPaidButUnconfirmed(context, state),
        ),
      ],
      child: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              controller: _scroll,
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: ContentWidth(
                child: Form(
                  key: _formKey,
                  child: AutofillGroup(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        KeyedSubtree(
                          key: _stepStarts[CheckoutStep.address],
                          child: const AddressSection(),
                        ),
                        const LocationSection(),
                        const DeliverySection(),
                        KeyedSubtree(
                          key: _stepStarts[CheckoutStep.personalise],
                          child: const PersonaliseSection(),
                        ),
                        const ExtrasSection(),
                        KeyedSubtree(
                          key: _stepStarts[CheckoutStep.payment],
                          child: const PaymentSection(),
                        ),
                        const PriceSummary(),
                        const MinimumOrderAlert(),
                        TermsSection(key: _termsKey),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          PlaceOrderBar(onPressed: _submit),
        ],
      ),
    );
  }
}
