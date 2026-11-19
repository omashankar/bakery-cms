import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/addresses_strings.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/choice_chips.dart';
import '../../../../core/widgets/form_section.dart';
import '../../../checkout/domain/entities/address_label.dart';
import '../../../checkout/presentation/widgets/address_label_text.dart';
import '../../../delivery_area/domain/services/pincode_autofill.dart';
import '../../../delivery_area/presentation/bloc/pincode_place_bloc.dart';
import '../../../delivery_area/presentation/bloc/pincode_place_event.dart';
import '../../../delivery_area/presentation/bloc/pincode_place_state.dart';
import '../../domain/entities/saved_address.dart';
import '../bloc/address_book_action.dart';
import '../bloc/address_book_cubit.dart';
import '../bloc/address_book_state.dart';

/// Adds or edits one address, in a sheet over the address book.
///
/// The same fields and limits as checkout's address section, so an address
/// saved here is one checkout accepts as it is.
///
/// A full PIN fills in the State when that box is still empty, as the
/// website's address book does; never over a state the customer typed.
/// Needs an [AddressBookCubit] and a [PincodePlaceBloc] above it ([show]
/// provides both).
class AddressFormSheet extends StatefulWidget {
  const AddressFormSheet({super.key, required this.initial});

  /// A new address (no id), possibly prefilled from the account, or the one
  /// being edited.
  final SavedAddress initial;

  static Future<void> show(BuildContext context, SavedAddress initial) {
    final cubit = context.read<AddressBookCubit>()..resetAction();
    return showModalBottomSheet<void>(
      context: context,
      // Over the tab bar, not under it: the tab's own navigator would
      // leave the bar drawn across the bottom of the sheet.
      useRootNavigator: true,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => MultiBlocProvider(
        providers: [
          BlocProvider.value(value: cubit),
          BlocProvider(create: (_) => GetIt.I<PincodePlaceBloc>()),
        ],
        child: AddressFormSheet(initial: initial),
      ),
    );
  }

  @override
  State<AddressFormSheet> createState() => _AddressFormSheetState();
}

class _AddressFormSheetState extends State<AddressFormSheet> {
  static const int _nameLength = 120;
  static const int _phoneLength = 16;
  static const int _lineLength = 200;
  static const int _cityLength = 80;
  static const int _pincodeLength = 6;
  static const int _altPhoneLength = 32;

  final _formKey = GlobalKey<FormState>();
  late final _fullName = TextEditingController(text: widget.initial.fullName);
  late final _email = TextEditingController(text: widget.initial.email);
  late final _phone = TextEditingController(text: widget.initial.phone);
  late final _line1 = TextEditingController(text: widget.initial.addressLine1);
  late final _line2 = TextEditingController(text: widget.initial.addressLine2);
  late final _landmark = TextEditingController(text: widget.initial.landmark);
  late final _city = TextEditingController(text: widget.initial.city);
  late final _state = TextEditingController(text: widget.initial.state);
  late final _pincode = TextEditingController(text: widget.initial.pincode);
  late final _altPhone = TextEditingController(text: widget.initial.altPhone ?? '');
  // A new address starts in the website form's country; an edit keeps what
  // was stored, blank included.
  late final _country = TextEditingController(
    text: widget.initial.isNew ? SavedAddress.defaultCountry : (widget.initial.country ?? ''),
  );
  late AddressLabel _kind = widget.initial.kind;

  /// The website's "Set as default address", ticked for the book's first.
  late bool _isDefault =
      widget.initial.isDefault ||
      (widget.initial.isNew && context.read<AddressBookCubit>().state.book.isEmpty);

  @override
  void initState() {
    super.initState();
    // The PIN an edited address already holds counts too, as on the website.
    _askWherePincodeIs();
    _pincode.addListener(_askWherePincodeIs);
  }

  void _askWherePincodeIs() =>
      context.read<PincodePlaceBloc>().add(PincodePlaceTyped(_pincode.text));

  /// The directory's state for the PIN still in the box, into an EMPTY State
  /// box only (the website's address book fills the state, not the city).
  void _fillFromPincode(PincodePlaceState answer) {
    final place = answer.place;
    if (place == null || answer.pincode != _pincode.text.trim()) return;
    final filled = PincodeAutofill.keep(_state.text, place.state);
    if (filled != _state.text) _state.text = filled;
  }

  @override
  void dispose() {
    _pincode.removeListener(_askWherePincodeIs);
    for (final controller in [
      _fullName,
      _email,
      _phone,
      _line1,
      _line2,
      _landmark,
      _city,
      _state,
      _pincode,
      _altPhone,
      _country,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _save() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final initial = widget.initial;
    // A label the customer typed on the website survives an edit here,
    // unless they picked a different kind.
    final label = !initial.isNew && _kind == initial.kind ? initial.label : _kind.apiValue;
    context.read<AddressBookCubit>().save(
      initial.copyWith(
        label: label,
        kind: _kind,
        fullName: _fullName.text.trim(),
        email: _email.text.trim(),
        phone: _phone.text.trim(),
        addressLine1: _line1.text.trim(),
        addressLine2: _line2.text.trim(),
        landmark: _landmark.text.trim(),
        city: _city.text.trim(),
        state: _state.text.trim(),
        pincode: _pincode.text.trim(),
        altPhone: _altPhone.text.trim(),
        country: _country.text.trim(),
        isDefault: _isDefault,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.viewInsetsOf(context);
    return MultiBlocListener(
      listeners: [
        BlocListener<AddressBookCubit, AddressBookState>(
          listenWhen: (previous, current) =>
              previous.actionStatus != current.actionStatus &&
              current.lastAction == AddressBookAction.save,
          listener: (context, state) {
            if (state.actionStatus.isSuccess) {
              AppSnackbar.success(context, AddressesStrings.saved);
              Navigator.of(context).pop();
            }
          },
        ),
        BlocListener<PincodePlaceBloc, PincodePlaceState>(
          listenWhen: (previous, current) => current.status.isSuccess && current.place != null,
          listener: (context, answer) => _fillFromPincode(answer),
        ),
      ],
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.xl,
          0,
          AppSpacing.xl,
          AppSpacing.xl + insets.bottom,
        ),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: AutofillGroup(
              child: FormSection(
                title: widget.initial.isNew
                    ? AddressesStrings.addTitle
                    : AddressesStrings.editTitle,
                children: [
                  AppTextField(
                    label: CheckoutStrings.fullName,
                    controller: _fullName,
                    validator: Validators.required,
                    maxLength: _nameLength,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.name],
                  ),
                  AppTextField(
                    label: CheckoutStrings.email,
                    controller: _email,
                    validator: Validators.email,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.email],
                  ),
                  AppTextField(
                    label: CheckoutStrings.phone,
                    controller: _phone,
                    validator: Validators.phone,
                    keyboardType: TextInputType.phone,
                    maxLength: _phoneLength,
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]'))],
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.telephoneNumber],
                  ),
                  AppTextField(
                    label: CheckoutStrings.addressLine1,
                    controller: _line1,
                    validator: Validators.required,
                    maxLength: _lineLength,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.streetAddressLine1],
                  ),
                  AppTextField(
                    label: CheckoutStrings.addressLine2,
                    controller: _line2,
                    maxLength: _lineLength,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.streetAddressLine2],
                  ),
                  AppTextField(
                    label: CheckoutStrings.landmark,
                    controller: _landmark,
                    maxLength: _lineLength,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                  ),
                  AppTextField(
                    key: const ValueKey('address-alt-phone'),
                    label: CheckoutStrings.altPhone,
                    controller: _altPhone,
                    keyboardType: TextInputType.phone,
                    maxLength: _altPhoneLength,
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]'))],
                    textInputAction: TextInputAction.next,
                  ),
                  AppTextField(
                    key: const ValueKey('address-country'),
                    label: CheckoutStrings.country,
                    controller: _country,
                    maxLength: _cityLength,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.countryName],
                  ),
                  AppTextField(
                    label: CheckoutStrings.city,
                    controller: _city,
                    validator: Validators.required,
                    maxLength: _cityLength,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.addressCity],
                  ),
                  AppTextField(
                    label: CheckoutStrings.state,
                    controller: _state,
                    validator: Validators.required,
                    maxLength: _cityLength,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.addressState],
                  ),
                  AppTextField(
                    label: CheckoutStrings.pincode,
                    controller: _pincode,
                    validator: Validators.pincode,
                    keyboardType: TextInputType.number,
                    maxLength: _pincodeLength,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.postalCode],
                  ),
                  ChoiceChips<AddressLabel>(
                    options: AddressLabel.values,
                    selected: _kind,
                    labelOf: (option) => option.text,
                    onSelected: (option) => setState(() => _kind = option),
                  ),
                  CheckboxListTile(
                    key: const ValueKey('address-default'),
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: const Text(AddressesStrings.setAsDefault),
                    value: _isDefault,
                    onChanged: (value) => setState(() => _isDefault = value ?? false),
                  ),
                  const _SaveError(),
                  BlocSelector<AddressBookCubit, AddressBookState, bool>(
                    selector: (state) => state.isBusy,
                    builder: (context, isSaving) => AppButton(
                      label: AddressesStrings.save,
                      isLoading: isSaving,
                      onPressed: _save,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SaveError extends StatelessWidget {
  const _SaveError();

  @override
  Widget build(BuildContext context) {
    return BlocSelector<AddressBookCubit, AddressBookState, String?>(
      selector: (state) =>
          state.actionStatus.isFailure && state.lastAction == AddressBookAction.save
          ? state.errorMessage
          : null,
      builder: (context, message) => message == null
          ? const SizedBox.shrink()
          : Text(message, style: context.text.bodySmall?.copyWith(color: context.colors.error)),
    );
  }
}
