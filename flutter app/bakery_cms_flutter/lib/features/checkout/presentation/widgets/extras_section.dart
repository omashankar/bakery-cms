import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/form_section.dart';
import '../../../offers/domain/entities/offer_cart_line.dart';
import '../../../offers/presentation/widgets/available_offers_list.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import 'coupon_field.dart';

/// Gift wrap, coupon and notes.
class ExtrasSection extends StatelessWidget {
  const ExtrasSection({super.key});

  static const int _notesMaxLength = 1000;
  static const int _notesLines = 3;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<CheckoutBloc>();
    return FormSection(
      title: CheckoutStrings.sectionExtras,
      children: [
        BlocSelector<CheckoutBloc, CheckoutState, (bool, bool, String, double, String)>(
          selector: (state) => (
            state.giftWrapAvailable,
            state.giftWrap,
            state.giftWrapLabel,
            state.giftWrapFee,
            state.currency,
          ),
          builder: (context, wrap) {
            final (available, enabled, label, fee, currency) = wrap;
            if (!available) return const SizedBox.shrink();
            return SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(label.isEmpty ? CheckoutStrings.giftWrapFee : label),
              subtitle: Text(
                fee > 0 ? MoneyFormatter.format(fee, currency: currency) : CheckoutStrings.free,
              ),
              value: enabled,
              onChanged: (value) => bloc.add(CheckoutGiftWrapToggled(value)),
            );
          },
        ),
        const CouponField(),
        // The shop's live offers under the box, as the website's checkout
        // shows them; Apply sends the code through the same quote as typing.
        // With the cart lines and their live categories, so a coupon kept to
        // some categories shows what it really saves here (the website's
        // `couponLines`); before the catalogue answers, the subtotal alone.
        BlocSelector<CheckoutBloc, CheckoutState, (double, String, String?, List<OfferCartLine>?)>(
          selector: (state) =>
              (state.subtotal, state.currency, state.quote?.coupon?.code, state.offerLines),
          builder: (context, offer) {
            final (subtotal, currency, applied, lines) = offer;
            return AvailableOffersList(
              subtotal: subtotal,
              currency: currency,
              lines: lines,
              appliedCode: applied,
              onApply: (code) => bloc.add(CheckoutCouponApplied(code)),
            );
          },
        ),
        AppTextField(
          label: CheckoutStrings.orderNotes,
          initialValue: bloc.state.orderNotes,
          maxLines: _notesLines,
          maxLength: _notesMaxLength,
          textCapitalization: TextCapitalization.sentences,
          onChanged: (value) => bloc.add(CheckoutNotesChanged(value)),
        ),
      ],
    );
  }
}
