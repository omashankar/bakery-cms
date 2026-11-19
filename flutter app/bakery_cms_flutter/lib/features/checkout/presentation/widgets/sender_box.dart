import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../domain/entities/order_personalisation.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';

/// "Who it is from": filled in from the signed-in account and shown as text
/// until Edit, as on the website. The person paying is not always the person
/// named, so Edit is there; a checkout that opens with two more empty boxes
/// reads as two more things to do.
class SenderBox extends StatefulWidget {
  const SenderBox({super.key});

  @override
  State<SenderBox> createState() => _SenderBoxState();
}

class _SenderBoxState extends State<SenderBox> {
  bool _editing = false;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<CheckoutBloc>();
    final muted = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    return BlocSelector<CheckoutBloc, CheckoutState, (String, String, bool)>(
      selector: (state) => (state.senderName, state.senderPhone, state.hideSender),
      builder: (context, sender) {
        final (name, phone, hidden) = sender;
        final summary = [name.trim(), phone.trim()].where((part) => part.isNotEmpty).join(' · ');
        final hasSender = summary.isNotEmpty;
        return AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(CheckoutStrings.senderTitle, style: context.text.labelLarge),
                        // The promise only when there is something to promise about.
                        if (hasSender) Text(CheckoutStrings.senderPromise, style: muted),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() => _editing = !_editing),
                    child: Text(_editing ? CheckoutStrings.done : CheckoutStrings.edit),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              if (_editing) ...[
                AppTextField(
                  label: CheckoutStrings.senderName,
                  initialValue: name,
                  maxLength: OrderPersonalisation.senderNameMaxLength,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  onChanged: (value) => bloc.add(CheckoutSenderChanged(name: value)),
                ),
                const SizedBox(height: AppSpacing.sm),
                AppTextField(
                  label: CheckoutStrings.senderPhone,
                  initialValue: phone,
                  keyboardType: TextInputType.phone,
                  maxLength: OrderPersonalisation.senderPhoneMaxLength,
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]'))],
                  autofillHints: const [AutofillHints.telephoneNumber],
                  onChanged: (value) => bloc.add(CheckoutSenderChanged(phone: value)),
                ),
              ] else
                Text(
                  hasSender ? summary : CheckoutStrings.senderNotSet,
                  style: hasSender ? context.text.bodyMedium : muted,
                ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: hidden,
                onChanged: (value) => bloc.add(CheckoutHideSenderToggled(value ?? false)),
                title: const Text(CheckoutStrings.keepSurprise),
                // The second sentence is a claim about values the shop holds,
                // so it waits until there are some.
                subtitle: Text(
                  hasSender
                      ? '${CheckoutStrings.keepSurpriseHint}${CheckoutStrings.keepSurpriseShopHas}'
                      : CheckoutStrings.keepSurpriseHint,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
