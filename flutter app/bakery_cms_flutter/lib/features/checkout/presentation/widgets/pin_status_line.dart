import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/utils/view_status.dart';
import '../../domain/entities/pin_check_result.dart';
import '../../domain/entities/pin_status.dart';

/// What the shop said about the dropped pin, in the website's words
/// (`PinStatus` and `PinAtPin` in delivery-pin-picker.tsx).
///
/// [pincode] is the PIN typed in the address. When the shop reads a
/// different one at the pin, [onUsePincode] offers it, one press; the box is
/// never changed for the customer.
class PinStatusLine extends StatelessWidget {
  const PinStatusLine({
    super.key,
    required this.status,
    required this.result,
    required this.currency,
    this.deliveryFree = false,
    this.pincode = '',
    this.onUsePincode,
  });

  final ViewStatus status;
  final PinCheckResult? result;
  final String currency;

  /// The shop's own quote prices delivery at nothing (an order over the
  /// free-delivery amount): the zone's fee is waived, so it is not shown.
  final bool deliveryFree;
  final String pincode;
  final ValueChanged<String>? onUsePincode;

  @override
  Widget build(BuildContext context) {
    if (status.isLoading) {
      return Row(
        children: [
          const SizedBox.square(
            dimension: AppSpacing.iconSm,
            child: CircularProgressIndicator(strokeWidth: AppSpacing.loaderStroke),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(CheckoutStrings.checkingPin, style: context.text.bodyMedium),
        ],
      );
    }
    final pin = result;
    if (pin == null) return const SizedBox.shrink();
    return pin.isEligible ? _eligible(context, pin) : _refused(context, pin);
  }

  Widget _eligible(BuildContext context, PinCheckResult pin) {
    final color = context.colors.tertiary;
    final typed = pincode.trim();
    final atPin = pin.postalCode?.trim() ?? '';
    final choices = pin.pincodeChoices(typed);
    final charge = pin.charge;
    return _Lines(
      icon: Icons.check_circle_outline,
      color: color,
      headline: CheckoutStrings.pinEligible,
      lines: [
        if ((pin.formattedAddress ?? '').isNotEmpty)
          '${CheckoutStrings.mapShowsHere}${pin.formattedAddress}',
        if (charge != null)
          '${CheckoutStrings.pinDeliveryCharge}: '
              '${deliveryFree || charge == 0 ? CheckoutStrings.free : MoneyFormatter.format(charge, currency: currency)}',
        if (atPin.isEmpty)
          CheckoutStrings.noPincodeHere(typed)
        else
          CheckoutStrings.pincodeHere(atPin, typed),
        if (pin.cityNote != null) pin.cityNote!,
      ],
      choicesLabel: pin.pincodeSure || typed != atPin
          ? CheckoutStrings.use
          : CheckoutStrings.notYourPinUse,
      choices: onUsePincode == null ? const [] : choices,
      onChoice: onUsePincode,
    );
  }

  Widget _refused(BuildContext context, PinCheckResult pin) {
    final color = pin.status.isSoft ? context.colors.secondary : context.colors.error;
    final fallback = pin.status == PinStatus.outside
        ? CheckoutStrings.pinOutside
        : CheckoutStrings.pinRefused;
    final found = pin.found?.formattedAddress;
    final km = pin.kmToArea;
    final suggested = pin.suggestedPincode(pincode);
    return _Lines(
      icon: pin.status.isSoft ? Icons.warning_amber_outlined : Icons.error_outline,
      color: color,
      // The shop's own sentence: for a mismatch it names the PIN it found.
      headline: pin.message ?? fallback,
      lines: [
        if (found != null)
          '${pin.status == PinStatus.outside ? CheckoutStrings.pinIsNear : CheckoutStrings.pinAt}: $found',
        if (pin.status == PinStatus.outside && km != null) CheckoutStrings.kmFromArea(km),
      ],
      action: suggested == null || onUsePincode == null
          ? null
          : OutlinedButton(
              onPressed: () => onUsePincode!(suggested),
              child: Text(CheckoutStrings.usePincode(suggested)),
            ),
    );
  }
}

class _Lines extends StatelessWidget {
  const _Lines({
    required this.icon,
    required this.color,
    required this.headline,
    required this.lines,
    this.choicesLabel = '',
    this.choices = const [],
    this.onChoice,
    this.action,
  });

  final IconData icon;
  final Color color;
  final String headline;
  final List<String> lines;
  final String choicesLabel;
  final List<String> choices;
  final ValueChanged<String>? onChoice;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: AppSpacing.iconMd),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(headline, style: context.text.bodyMedium?.copyWith(color: color)),
              for (final line in lines) Text(line, style: muted),
              if (choices.isNotEmpty && onChoice != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: AppSpacing.sm,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(choicesLabel, style: muted),
                    for (final code in choices)
                      OutlinedButton(onPressed: () => onChoice!(code), child: Text(code)),
                  ],
                ),
              ],
              if (action != null) ...[const SizedBox(height: AppSpacing.sm), action!],
            ],
          ),
        ),
      ],
    );
  }
}
