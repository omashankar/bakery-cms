import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import 'checkout_step.dart';

/// Which step of the checkout is on screen, for the header's steps.
///
/// Checkout is one scrolling screen, so the step follows the scroll
/// ([reached]); a step tapped in the header asks the screen to scroll to it
/// ([jumpTo]), which the form hears on [jumps].
class CheckoutStepCubit extends Cubit<CheckoutStep> {
  CheckoutStepCubit() : super(CheckoutStep.address);

  final StreamController<CheckoutStep> _jumps = StreamController<CheckoutStep>.broadcast();

  Stream<CheckoutStep> get jumps => _jumps.stream;

  void reached(CheckoutStep step) {
    if (step != state) emit(step);
  }

  void jumpTo(CheckoutStep step) {
    if (!_jumps.isClosed) _jumps.add(step);
  }

  @override
  Future<void> close() async {
    await _jumps.close();
    return super.close();
  }
}
