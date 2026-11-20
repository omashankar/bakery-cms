import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import '../bloc/coupon_status.dart';

/// Type a code and apply it. It shows as applied only once the shop priced
/// the cart with it; while pricing it shows as being checked.
class CouponField extends StatefulWidget {
  const CouponField({super.key});

  /// The shop's own limit (`couponCode` max 40 in the quote schema); a longer
  /// code failed the whole running total.
  static const int maxLength = 40;

  @override
  State<CouponField> createState() => _CouponFieldState();
}

class _CouponFieldState extends State<CouponField> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _apply() {
    FocusManager.instance.primaryFocus?.unfocus();
    context.read<CheckoutBloc>().add(CheckoutCouponApplied(_controller.text));
  }

  void _remove() {
    _controller.clear();
    context.read<CheckoutBloc>().add(const CheckoutCouponRemoved());
  }

  @override
  Widget build(BuildContext context) {
    return BlocSelector<CheckoutBloc, CheckoutState, (CouponStatus, String?)>(
      selector: (state) => (state.couponStatus, state.couponCode),
      builder: (context, coupon) {
        final (status, code) = coupon;
        if (status == CouponStatus.applied || status == CouponStatus.checking) {
          return _CouponChip(
            code: code!,
            checking: status == CouponStatus.checking,
            onRemove: _remove,
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: AppTextField(
                controller: _controller,
                label: CheckoutStrings.coupon,
                maxLength: CouponField.maxLength,
                textCapitalization: TextCapitalization.characters,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _apply(),
                errorText: switch (status) {
                  CouponStatus.rejected => CheckoutStrings.couponRejected,
                  CouponStatus.unconfirmed => CheckoutStrings.couponNotChecked,
                  _ => null,
                },
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            AppButton.secondary(
              label: CheckoutStrings.applyCoupon,
              expand: false,
              onPressed: _apply,
            ),
          ],
        );
      },
    );
  }
}

class _CouponChip extends StatelessWidget {
  const _CouponChip({required this.code, required this.checking, required this.onRemove});

  final String code;
  final bool checking;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final label = checking ? CheckoutStrings.couponChecking : CheckoutStrings.couponApplied;
    return Align(
      alignment: Alignment.centerLeft,
      child: InputChip(
        avatar: checking
            ? const SizedBox.square(
                dimension: AppSpacing.iconSm,
                child: CircularProgressIndicator(strokeWidth: AppSpacing.loaderStroke),
              )
            : const Icon(Icons.local_offer_outlined, size: AppSpacing.iconSm),
        label: Text('$label${CheckoutStrings.separator}$code'),
        deleteButtonTooltipMessage: CheckoutStrings.removeCoupon,
        onDeleted: onRemove,
      ),
    );
  }
}
