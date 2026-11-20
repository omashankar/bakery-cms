import '../../../../core/constants/strings/checkout_strings.dart';

/// The four steps of buying, as the website's checkout header names them:
/// the cart is the first, so the screen a customer spends longest on shows
/// where they are.
enum CheckoutStep {
  cart(CheckoutStrings.stepCart),
  address(CheckoutStrings.stepAddress),
  personalise(CheckoutStrings.stepPersonalise),
  payment(CheckoutStrings.stepPayment);

  const CheckoutStep(this.label);

  final String label;
}
