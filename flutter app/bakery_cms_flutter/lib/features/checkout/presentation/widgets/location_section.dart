import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/view_status.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/form_section.dart';
import '../../domain/entities/geo_point.dart';
import '../../domain/entities/pin_check_result.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import 'pin_status_line.dart';

/// The map pin. Shown only when the shop delivers by area.
class LocationSection extends StatelessWidget {
  const LocationSection({super.key});

  Future<void> _pick(BuildContext context, GeoPoint? current) async {
    final bloc = context.read<CheckoutBloc>();
    // Let go of the field being typed in. Otherwise focus comes back to it
    // when the map closes and the keyboard pops up over the pin result.
    // The FIELD's focus, not the page's: unfocusing the page's scope hides
    // the keyboard, but the scope still remembers the field and hands focus
    // straight back to it when the map closes (test/app/focus_after_pop_test).
    FocusManager.instance.primaryFocus?.unfocus();
    final point = await context.push<GeoPoint>(AppRoutes.mapPicker, extra: current);
    if (point != null) bloc.add(CheckoutLocationPicked(point));
  }

  @override
  Widget build(BuildContext context) {
    return BlocSelector<
      CheckoutBloc,
      CheckoutState,
      (bool, GeoPoint?, ViewStatus, PinCheckResult?, String, bool, String)
    >(
      selector: (state) => (
        state.zonesRequired,
        state.address.location,
        state.pinStatus,
        state.pinResult,
        state.currency,
        state.quote?.totals.delivery == 0,
        state.address.pincode,
      ),
      builder: (context, view) {
        final (required, location, status, result, currency, deliveryFree, pincode) = view;
        if (!required) return const SizedBox.shrink();
        return FormSection(
          title: CheckoutStrings.sectionLocation,
          children: [
            Text(
              CheckoutStrings.locationHelp,
              style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
            ),
            PinStatusLine(
              status: status,
              result: result,
              currency: currency,
              deliveryFree: deliveryFree,
              pincode: pincode,
              onUsePincode: (code) =>
                  context.read<CheckoutBloc>().add(CheckoutPincodeSuggestionUsed(code)),
            ),
            AppButton.secondary(
              label: location == null ? CheckoutStrings.pickOnMap : CheckoutStrings.changePin,
              icon: Icons.location_on_outlined,
              isLoading: status.isLoading,
              onPressed: () => _pick(context, location),
            ),
          ],
        );
      },
    );
  }
}
