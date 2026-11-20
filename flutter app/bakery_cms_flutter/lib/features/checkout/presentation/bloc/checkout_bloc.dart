import 'dart:async';
import 'dart:math';

import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_durations.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/error/server_failure.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/utils/view_status.dart';
import '../../../addresses/domain/entities/saved_address.dart';
import '../../../addresses/domain/usecases/load_address_book.dart';
import '../../../addresses/domain/usecases/remember_address.dart';
import '../../../delivery_area/domain/services/pincode_autofill.dart';
import '../../../delivery_area/domain/usecases/find_pincode_place.dart';
import '../../../store/domain/entities/delivery_tier.dart';
import '../../../store/domain/entities/store_config.dart';
import '../../domain/failures/paid_but_unconfirmed_failure.dart';
import '../../domain/failures/price_change_reason.dart';
import '../../domain/failures/price_changed_failure.dart';
import '../../domain/services/saved_address_mapper.dart';
import '../../domain/services/shop_clock.dart';
import '../../domain/entities/checkout_address.dart';
import '../../domain/entities/checkout_catalog.dart';
import '../../domain/entities/order_personalisation.dart';
import '../../domain/entities/order_sender.dart';
import '../../domain/entities/delivery_schedule.dart';
import '../../domain/entities/delivery_slot.dart';
import '../../domain/entities/payment_method.dart';
import '../../domain/entities/pin_check_request.dart';
import '../../domain/entities/quote_request.dart';
import '../../domain/repositories/payment_gateway.dart';
import '../../domain/usecases/check_delivery_pin.dart';
import '../../domain/usecases/check_online_payment.dart';
import '../../domain/usecases/get_checkout_catalog.dart';
import '../../domain/usecases/estimate_quote.dart';
import '../../domain/usecases/place_order.dart';
import '../../domain/usecases/place_order_params.dart';
import 'checkout_event.dart';
import 'checkout_state.dart';

/// The checkout flow: collect the address, pin, slot and payment choice, keep
/// a running total, then place the order.
///
/// Every price comes from the shop. The bloc only decides what to ask for and
/// when; [PlaceOrder] does the placing.
class CheckoutBloc extends Bloc<CheckoutEvent, CheckoutState> {
  CheckoutBloc({
    required EstimateQuote estimateQuote,
    required CheckDeliveryPin checkDeliveryPin,
    required PlaceOrder placeOrder,
    required PaymentGateway paymentGateway,
    required String Function() newOrderId,
    DateTime Function()? clock,
    DateTime Function() instant = DateTime.now,
    LoadAddressBook? loadAddressBook,
    RememberAddress? rememberAddress,
    CheckOnlinePayment? checkOnlinePayment,
    GetCheckoutCatalog? getCheckoutCatalog,
    FindPincodePlace? findPincodePlace,
    Duration addressPause = defaultAddressPause,
    Duration pincodePause = AppDurations.pincodeLookup,
  }) : _estimateQuote = estimateQuote,
       _checkDeliveryPin = checkDeliveryPin,
       _placeOrder = placeOrder,
       _paymentGateway = paymentGateway,
       _loadAddressBook = loadAddressBook,
       _rememberAddress = rememberAddress,
       _checkOnlinePayment = checkOnlinePayment,
       _getCheckoutCatalog = getCheckoutCatalog,
       _findPincodePlace = findPincodePlace,
       _addressPause = addressPause,
       _pincodePause = pincodePause,
       _clockOverride = clock,
       _instant = instant,
       _wallClock = clock ?? ShopClock(StoreConfig.defaultTimezone, instant: instant).now,
       // One id for the whole checkout, reused on every press: see
       // [PlaceOrderParams.orderId]. Never re-minted, not even after a
       // refusal: an earlier press whose answer was lost may have placed the
       // order, and only the same id lets the shop recognise it.
       _orderId = newOrderId(),
       super(const CheckoutState()) {
    on<CheckoutStarted>(_onStarted);
    on<CheckoutAddressFieldChanged>(_onFieldChanged);
    on<CheckoutAddressLabelChanged>(
      (event, emit) => emit(state.copyWith(address: state.address.copyWith(label: event.label))),
    );
    on<CheckoutLocationPicked>(_onLocationPicked, transformer: restartable());
    on<CheckoutTierSelected>(_onTierSelected);
    on<CheckoutDateSelected>(_onDateSelected);
    on<CheckoutSlotSelected>((event, emit) => emit(state.copyWith(timeSlot: () => event.timeSlot)));
    on<CheckoutGiftWrapToggled>(_onGiftWrapToggled);
    on<CheckoutCouponApplied>(_onCouponApplied);
    on<CheckoutCouponRemoved>(_onCouponRemoved);
    on<CheckoutNotesChanged>((event, emit) => emit(state.copyWith(orderNotes: event.notes)));
    on<CheckoutPaymentMethodSelected>(
      (event, emit) => emit(state.copyWith(paymentMethod: () => event.method)),
    );
    on<CheckoutEstimateRequested>(_onEstimateRequested, transformer: restartable());
    on<CheckoutPlaceOrderPressed>(_onPlaceOrderPressed, transformer: droppable());
    on<CheckoutAddressBookRequested>(_onAddressBookRequested, transformer: droppable());
    on<CheckoutSavedAddressChosen>((event, emit) => _fillFrom(event.address, emit));
    on<CheckoutOccasionSelected>(
      (event, emit) => emit(state.copyWith(occasion: () => event.occasion)),
    );
    on<CheckoutGiftMessageChanged>(
      (event, emit) => emit(state.copyWith(giftMessage: event.message)),
    );
    on<CheckoutSenderChanged>(
      (event, emit) => emit(state.copyWith(senderName: event.name, senderPhone: event.phone)),
    );
    on<CheckoutHideSenderToggled>((event, emit) => emit(state.copyWith(hideSender: event.hidden)));
    on<CheckoutTermsToggled>(
      // Cleared on the tick, or the red line outlives the correction.
      (event, emit) => emit(
        state.copyWith(
          termsAccepted: event.accepted,
          termsError: event.accepted ? () => null : null,
        ),
      ),
    );
    on<CheckoutPincodeSuggestionUsed>(_onPincodeSuggestionUsed);
    on<CheckoutOnlinePaymentAnswered>(_onOnlinePaymentAnswered);
    on<CheckoutCatalogLoaded>(_onCatalogLoaded);
    on<CheckoutPincodePlaceRequested>(_onPincodePlaceRequested, transformer: restartable());
  }

  /// How long typing in the address must stop before a pinned re-price.
  static const Duration defaultAddressPause = Duration(milliseconds: 600);

  final EstimateQuote _estimateQuote;
  final CheckDeliveryPin _checkDeliveryPin;
  final PlaceOrder _placeOrder;
  final PaymentGateway _paymentGateway;
  final LoadAddressBook? _loadAddressBook;
  final RememberAddress? _rememberAddress;
  final CheckOnlinePayment? _checkOnlinePayment;
  final GetCheckoutCatalog? _getCheckoutCatalog;
  final FindPincodePlace? _findPincodePlace;
  final Duration _addressPause;

  /// How long the PIN must stay put before its place is looked up.
  final Duration _pincodePause;

  /// The shop's own switches for the two ways to pay (before this cart).
  bool _onlineSwitchedOn = false;

  /// What `/api/razorpay/availability` said; null until (or unless) it says.
  bool? _onlineConfigured;

  /// The last running total's request, when it was priced. An identical
  /// request is not sent again: the answer would be the same.
  QuoteRequest? _lastPriced;

  /// What the latest estimate was priced at when it carried the full address
  /// and pin (see [_pinnedKeyOf]); null when it was the address-less total.
  String? _pinnedKey;

  /// The PIN code filled from the chosen delivery area at start, while it
  /// is still the only thing in the address: it does not count as the
  /// customer having started one, so the saved default still fills the form.
  String? _prefilledPincode;
  final DateTime Function()? _clockOverride;
  final DateTime Function() _instant;
  final String _orderId;

  /// Now on the SHOP's clock (see [ShopClock]); replaced on start once the
  /// shop's timezone is known.
  DateTime Function() _wallClock;

  int _leadDays = 0;

  /// The pinned area's own preparation days (0 until a pin is checked).
  int _zoneMinDays = 0;
  String _sameDayCutoff = '';

  /// The shop takes the stricter of its lead time and the area's.
  DeliverySchedule get _schedule => DeliverySchedule(
    now: _wallClock(),
    leadDays: max(_leadDays, _zoneMinDays),
    sameDayCutoff: _sameDayCutoff,
  );

  void _onStarted(CheckoutStarted event, Emitter<CheckoutState> emit) {
    final config = event.config;
    final cart = event.cart;
    _leadDays = config.deliveryLeadDays;
    _sameDayCutoff = config.sameDayCutoff;
    _wallClock = _clockOverride ?? ShopClock(config.timezone, instant: _instant).now;

    final allowed = cart.allowedTierIds(config.deliveryTiers.map((tier) => tier.id).toList());
    final tiers = config.deliveryTiers.where((tier) => allowed.contains(tier.id)).toList();
    final tier = tiers.isEmpty ? null : tiers.first;
    final dates = _schedule.bookableDates;
    final date = dates.isEmpty ? null : dates.first;

    // Until the live catalogue answers, the lines' own snapshot stands in;
    // it is replaced by the shop's word as soon as that arrives.
    final codBlockedBy = [
      for (final item in cart.items)
        if (!item.codAllowed) item.name,
    ];
    final cod = config.paymentMethods.cod && codBlockedBy.isEmpty;
    _onlineSwitchedOn = config.paymentMethods.online && _paymentGateway.isSupported;
    final online = _onlineSwitchedOn;
    final customer = event.customer;

    emit(
      state.copyWith(
        setupStatus: ViewStatus.success,
        items: cart.items,
        currency: config.currency,
        shopName: config.siteName,
        zonesRequired: config.useZoneBasedDelivery,
        tierRequired: config.deliveryTiers.isNotEmpty,
        giftWrapAvailable: config.giftWrapEnabled,
        giftWrapFee: config.giftWrapFee,
        giftWrapLabel: config.giftWrapLabel,
        checkoutTerms: config.checkoutTerms,
        cancellationPolicyText: config.cancellationPolicyText,
        policyClasses: const CheckoutCatalog({}).policyClasses(cart.items),
        minOrderValue: config.minOrderValue,
        maintenanceNotice: () => config.maintenanceEnabled ? config.maintenanceNotice : null,
        codOffered: config.paymentMethods.cod,
        codBlockedBy: codBlockedBy,
        // The sender defaults to whoever is signed in, never asserted as fact.
        senderName: customer?.name ?? '',
        senderPhone: customer?.phone ?? '',
        tiers: tiers,
        fallbackSlots: config.deliveryTimeSlots,
        dates: dates,
        windows: _windowsFor(tier, date, config.deliveryTimeSlots),
        codAvailable: cod,
        onlineAvailable: online,
        tierId: () => tier?.id,
        date: () => date,
        paymentMethod: () => online ? PaymentMethod.online : (cod ? PaymentMethod.cod : null),
        address: _withDeliveryPincode(
          customer == null
              ? state.address
              : state.address.copyWith(
                  fullName: customer.name,
                  email: customer.email,
                  phone: customer.phone,
                ),
          event.deliveryPincode,
        ),
      ),
    );
    if (cart.items.isNotEmpty) add(const CheckoutEstimateRequested());
    if (_loadAddressBook != null) add(const CheckoutAddressBookRequested());
    _askGateway();
    _readCatalog();
  }

  /// Asks the shop up front whether it can take an online payment, as the
  /// website does: offering "Pay online" on a gateway with no keys means the
  /// customer finds out at the last press.
  void _askGateway() {
    final ask = _checkOnlinePayment;
    if (ask == null || !_onlineSwitchedOn) return;
    unawaited(
      ask(const NoParams()).then((result) {
        if (isClosed) return;
        // A refusal or an unreadable answer is not an answer: "unknown"
        // keeps the method on offer.
        add(CheckoutOnlinePaymentAnswered(result.getRight().toNullable()));
      }),
    );
  }

  /// The live catalogue: cash on delivery, the occasions and the
  /// cancellation rules all come from the shop's products as they are now.
  void _readCatalog() {
    final read = _getCheckoutCatalog;
    if (read == null) return;
    unawaited(
      read(const NoParams()).then((result) {
        if (isClosed) return;
        // Unreadable: the lines' snapshot stays, and the server decides.
        final catalog = result.getRight().toNullable();
        if (catalog != null) add(CheckoutCatalogLoaded(catalog));
      }),
    );
  }

  void _onOnlinePaymentAnswered(CheckoutOnlinePaymentAnswered event, Emitter<CheckoutState> emit) {
    _onlineConfigured = event.configured;
    _offerPayments(emit, online: _onlineSwitchedOn && _onlineConfigured != false);
  }

  void _onCatalogLoaded(CheckoutCatalogLoaded event, Emitter<CheckoutState> emit) {
    final catalog = event.catalog;
    final blocked = catalog.codBlockedBy(state.items);
    emit(
      state.copyWith(
        codBlockedBy: blocked,
        offerLines: () => catalog.offerLines(state.items),
        occasionOptions: catalog.occasionOptions,
        policyClasses: catalog.policyClasses(state.items),
        // An occasion the shop no longer tags anything with is let go.
        occasion: catalog.occasionOptions.contains(state.occasion) ? null : () => null,
      ),
    );
    _offerPayments(emit, cod: state.codOffered && blocked.isEmpty);
  }

  /// Re-offers the ways to pay, keeping the chosen one when it is still on
  /// offer and otherwise moving to the first that is (online first): a
  /// method that is no longer offered must never stay selected.
  void _offerPayments(Emitter<CheckoutState> emit, {bool? online, bool? cod}) {
    final onlineNow = online ?? state.onlineAvailable;
    final codNow = cod ?? state.codAvailable;
    final chosen = state.paymentMethod;
    final stillOffered =
        (chosen == PaymentMethod.online && onlineNow) || (chosen == PaymentMethod.cod && codNow);
    emit(
      state.copyWith(
        onlineAvailable: onlineNow,
        codAvailable: codNow,
        paymentMethod: stillOffered
            ? null
            : () => onlineNow ? PaymentMethod.online : (codNow ? PaymentMethod.cod : null),
      ),
    );
  }

  void _onPincodeSuggestionUsed(CheckoutPincodeSuggestionUsed event, Emitter<CheckoutState> emit) {
    final code = event.pincode.trim();
    if (code.isEmpty || state.isLocked) return;
    emit(state.copyWith(address: state.address.copyWith(pincode: code)));
    // Checked again against the PIN now in the box, as the website re-checks
    // whenever the typed PIN changes.
    final location = state.address.location;
    if (location != null) add(CheckoutLocationPicked(location));
  }

  /// The book fills the form from its default, unless the customer has
  /// already started on an address. Silent when it cannot be read: checkout
  /// works without it.
  Future<void> _onAddressBookRequested(
    CheckoutAddressBookRequested event,
    Emitter<CheckoutState> emit,
  ) async {
    final load = _loadAddressBook;
    if (load == null) return;
    final book = (await load()).getRight().toNullable();
    if (book == null || book.isEmpty) return;
    emit(state.copyWith(savedAddresses: book.sorted));
    final preferred = book.defaultAddress;
    if (preferred != null && !_hasStartedAddress(state.address)) _fillFrom(preferred, emit);
  }

  /// [address] with the chosen delivery area's PIN code in an empty PIN
  /// field. A PIN already there (typed, or from the account) is kept.
  CheckoutAddress _withDeliveryPincode(CheckoutAddress address, String? pincode) {
    final chosen = pincode?.trim() ?? '';
    if (address.pincode.trim().isNotEmpty || Validators.pincode(chosen) != null) return address;
    _prefilledPincode = chosen;
    return address.copyWith(pincode: chosen);
  }

  /// Anything typed (or filled from the pin) beyond who the customer is. The
  /// PIN code prefilled from the delivery area alone is not a start.
  bool _hasStartedAddress(CheckoutAddress a) => [
    a.addressLine1,
    a.addressLine2,
    a.landmark,
    a.city,
    a.state,
    if (a.pincode.trim() != _prefilledPincode) a.pincode,
  ].any((value) => value.trim().isNotEmpty);

  /// Fills the form from [saved]. A pin dropped for a different place is
  /// cleared, so the customer pins this one; the saved address has none.
  void _fillFrom(SavedAddress saved, Emitter<CheckoutState> emit) {
    final before = state.address;
    final keepPin = before.location == null || SavedAddressMapper.isSamePlace(before, saved);
    emit(
      state.copyWith(
        address: SavedAddressMapper.toCheckout(saved, current: before, keepLocation: keepPin),
        pinStatus: keepPin ? null : ViewStatus.initial,
        pinResult: keepPin ? null : () => null,
      ),
    );
    if (!keepPin) _applyZoneMinDays(0, emit);
    _reprice(before);
  }

  /// WHERE THE PIN REALLY IS, whichever way it got into the box: typed, from
  /// the delivery area, a saved address, the map pin or "Use PIN". The
  /// website's checkout asks India Post's directory whenever the box holds a
  /// full PIN; so does this, after a pause in typing.
  @override
  void onChange(Change<CheckoutState> change) {
    super.onChange(change);
    final pin = change.nextState.address.pincode.trim();
    if (_findPincodePlace == null || pin == change.currentState.address.pincode.trim()) return;
    if (Validators.pincode(pin) == null) add(CheckoutPincodePlaceRequested(pin));
  }

  /// Fills City (the PIN's first district) and State from the directory,
  /// into the boxes left EMPTY: what the customer typed stays theirs, as on
  /// the website. Silent when the directory cannot be asked or does not
  /// know the PIN, and nothing waits on it. A newer PIN cancels this one.
  Future<void> _onPincodePlaceRequested(
    CheckoutPincodePlaceRequested event,
    Emitter<CheckoutState> emit,
  ) async {
    final find = _findPincodePlace;
    if (find == null) return;
    final code = event.pincode;
    await Future<void>.delayed(_pincodePause);
    if (emit.isDone || state.address.pincode.trim() != code) return;
    final place = (await find(code)).getRight().toNullable();
    // Moved on while the directory was asked: the answer is for another PIN.
    if (place == null || emit.isDone || state.isLocked || state.address.pincode.trim() != code) {
      return;
    }
    final before = state.address;
    final filled = before.copyWith(
      city: PincodeAutofill.keep(before.city, place.city),
      state: PincodeAutofill.keep(before.state, place.state),
    );
    if (filled == before) return;
    emit(state.copyWith(address: filled));
    _reprice(before);
  }

  void _onFieldChanged(CheckoutAddressFieldChanged event, Emitter<CheckoutState> emit) {
    final before = state.address;
    emit(state.copyWith(address: before.withField(event.field, event.value)));
    _reprice(before, afterPause: true);
  }

  /// Re-price after the address or pin changed from [before]:
  ///
  /// - complete address + eligible pin: the exact total WITH the address
  ///   (the zone's own charge), when what it is priced on changed;
  /// - no longer complete, after an exact total: back to the running total;
  /// - otherwise the running total, when a valid PIN appeared or changed.
  void _reprice(CheckoutAddress before, {bool afterPause = false}) {
    final key = _pinnedKeyOf(state);
    if (key != null) {
      if (key != _pinnedKey) add(CheckoutEstimateRequested(afterPause: afterPause));
    } else if (_pinnedKey != null) {
      add(const CheckoutEstimateRequested());
    } else if (_pincodeChanged(before.pincode, state.address.pincode)) {
      add(const CheckoutEstimateRequested());
    }
  }

  /// What a full-address quote is priced on, or null when the shop cannot
  /// price one yet: the pin must be checked and eligible, and every required
  /// field valid. Name or phone edits do not change it, so they never
  /// re-price; becoming valid or invalid does.
  static String? _pinnedKeyOf(CheckoutState s) {
    final a = s.address;
    final location = a.location;
    final pin = s.pinResult;
    if (location == null || pin == null || !pin.isEligible || !_addressComplete(a)) return null;
    String norm(String value) => value.trim().toLowerCase();
    return '${location.lat},${location.lng}|${norm(a.pincode)}|${norm(a.city)}|${norm(a.state)}';
  }

  /// Every field the shop requires, valid.
  static bool _addressComplete(CheckoutAddress a) => [
    Validators.required(a.fullName),
    Validators.email(a.email),
    Validators.phone(a.phone),
    Validators.required(a.addressLine1),
    Validators.required(a.city),
    Validators.required(a.state),
    Validators.pincode(a.pincode),
  ].every((error) => error == null);

  /// Re-price when a valid PIN appears, changes, or stops being valid.
  bool _pincodeChanged(String before, String after) {
    final wasValid = Validators.pincode(before) == null;
    final isValid = Validators.pincode(after) == null;
    if (isValid) return before.trim() != after.trim();
    return wasValid;
  }

  Future<void> _onLocationPicked(CheckoutLocationPicked event, Emitter<CheckoutState> emit) async {
    final address = state.address.copyWith(location: event.location);
    emit(state.copyWith(address: address, pinStatus: ViewStatus.loading, pinResult: () => null));

    final result = await _checkDeliveryPin(
      PinCheckRequest(
        location: event.location,
        pincode: address.pincode,
        city: address.city,
        state: address.state,
      ),
    );
    result.match(
      (failure) {
        emit(
          state.copyWith(
            pinStatus: ViewStatus.failure,
            errorMessage: failure.message,
            errorField: 'location',
          ),
        );
        // An exact total for the old pin no longer holds.
        _reprice(state.address);
      },
      (pin) {
        final before = state.address;
        final filled = _autofill(before, pin.city, pin.state, pin.postalCode);
        emit(state.copyWith(address: filled, pinStatus: ViewStatus.success, pinResult: () => pin));
        _applyZoneMinDays(pin.isEligible ? (pin.minDeliveryDays ?? 0) : 0, emit);
        _reprice(before);
      },
    );
  }

  /// An area that needs more days than the shop moves the first bookable
  /// date; the picker must not offer dates the quote will refuse.
  void _applyZoneMinDays(int days, Emitter<CheckoutState> emit) {
    if (days == _zoneMinDays) return;
    _zoneMinDays = days;
    final dates = _schedule.bookableDates;
    final kept = state.date;
    final date = kept != null && dates.any((d) => DeliverySchedule.isSameDay(d, kept))
        ? kept
        : (dates.isEmpty ? null : dates.first);
    final windows = _windowsFor(state.selectedTier, date, state.fallbackSlots);
    emit(
      state.copyWith(
        dates: dates,
        date: () => date,
        windows: windows,
        timeSlot: () => windows.contains(state.timeSlot) ? state.timeSlot : null,
      ),
    );
  }

  /// Fills the address parts the customer left empty from what the shop read
  /// at the pin. Never overwrites what they typed.
  CheckoutAddress _autofill(CheckoutAddress address, String? city, String? region, String? pin) {
    String keep(String typed, String? found) => typed.trim().isEmpty ? (found ?? '') : typed;
    return address.copyWith(
      city: keep(address.city, city),
      state: keep(address.state, region),
      pincode: keep(address.pincode, pin),
    );
  }

  void _onTierSelected(CheckoutTierSelected event, Emitter<CheckoutState> emit) {
    DeliveryTier? tier;
    for (final candidate in state.tiers) {
      if (candidate.id == event.tierId) tier = candidate;
    }
    final windows = _windowsFor(tier, state.date, state.fallbackSlots);
    emit(
      state.copyWith(
        tierId: () => event.tierId,
        windows: windows,
        timeSlot: () => windows.contains(state.timeSlot) ? state.timeSlot : null,
      ),
    );
    add(const CheckoutEstimateRequested());
  }

  void _onDateSelected(CheckoutDateSelected event, Emitter<CheckoutState> emit) {
    final windows = _windowsFor(state.selectedTier, event.date, state.fallbackSlots);
    emit(
      state.copyWith(
        date: () => event.date,
        windows: windows,
        timeSlot: () => windows.contains(state.timeSlot) ? state.timeSlot : null,
      ),
    );
  }

  List<String> _windowsFor(DeliveryTier? tier, DateTime? date, List<String> fallback) {
    if (date == null) return const [];
    return _schedule.windowsFor(date: date, tier: tier, fallbackSlots: fallback);
  }

  void _onGiftWrapToggled(CheckoutGiftWrapToggled event, Emitter<CheckoutState> emit) {
    emit(state.copyWith(giftWrap: event.enabled));
    add(const CheckoutEstimateRequested());
  }

  void _onCouponApplied(CheckoutCouponApplied event, Emitter<CheckoutState> emit) {
    final code = event.code.trim();
    if (code.isEmpty) return;
    emit(state.copyWith(couponCode: () => code, couponRejected: false));
    add(const CheckoutEstimateRequested());
  }

  void _onCouponRemoved(CheckoutCouponRemoved event, Emitter<CheckoutState> emit) {
    emit(state.copyWith(couponCode: () => null, couponRejected: false));
    add(const CheckoutEstimateRequested());
  }

  Future<void> _onEstimateRequested(
    CheckoutEstimateRequested event,
    Emitter<CheckoutState> emit,
  ) async {
    if (state.items.isEmpty) return;
    if (event.afterPause) {
      await Future<void>.delayed(_addressPause);
      if (emit.isDone) return; // a newer request replaced this one
    }
    final address = state.address;
    // With the pin checked and the address complete, ask for the exact total:
    // the shop prices the pinned zone only when it gets the whole address.
    final pinnedKey = _pinnedKeyOf(state);
    final pinned = pinnedKey != null;
    final hasPincode = !pinned && Validators.pincode(address.pincode) == null;
    final request = QuoteRequest(
      items: state.items,
      couponCode: state.couponCode,
      giftWrap: state.giftWrap,
      deliveryTierId: state.tierId,
      pincode: hasPincode ? address.pincode : null,
      city: hasPincode ? address.city : null,
      state: hasPincode ? address.state : null,
      address: pinned ? address : null,
    );
    // The same body as the total on screen: the shop would answer the same,
    // and a full-address quote writes a draft each time it is asked.
    if (request == _lastPriced && state.estimateStatus.isSuccess) {
      _pinnedKey = pinnedKey;
      return;
    }
    _pinnedKey = pinnedKey;
    emit(state.copyWith(estimateStatus: ViewStatus.loading, estimateError: () => null));

    final result = await _estimateQuote(request);
    result.match(
      (failure) {
        _lastPriced = null;
        emit(
          state.copyWith(estimateStatus: ViewStatus.failure, estimateError: () => failure.message),
        );
      },
      (quote) {
        _lastPriced = request;
        final rejected = state.couponCode != null && quote.rejectedCoupon != null;
        final newlyRejected = rejected && !state.couponRejected;
        emit(
          state.copyWith(
            estimateStatus: ViewStatus.success,
            quote: () => quote,
            couponRejected: rejected,
            errorMessage: newlyRejected ? CheckoutStrings.couponRejected : null,
            errorField: newlyRejected ? 'couponCode' : null,
          ),
        );
      },
    );
  }

  Future<void> _onPlaceOrderPressed(
    CheckoutPlaceOrderPressed event,
    Emitter<CheckoutState> emit,
  ) async {
    // Locked after a payment went through: never take a second one.
    if (state.items.isEmpty || state.isPlacing || state.isLocked) return;

    final refusal = _refusal();
    if (refusal != null) {
      final (message, field) = refusal;
      emit(
        state.copyWith(
          errorMessage: message,
          errorField: field,
          termsError: field == termsField ? () => message : null,
        ),
      );
      return;
    }

    emit(state.copyWith(placeStatus: ViewStatus.loading));
    final tier = state.selectedTier;
    final shown = state.estimateStatus.isSuccess ? state.quote?.totals.total : null;
    final result = await _placeOrder(
      PlaceOrderParams(
        orderId: _orderId,
        expectedTotal: shown,
        items: state.items,
        address: state.address,
        slot: DeliverySlot(
          date: state.date!,
          timeSlot: state.timeSlot ?? '',
          tierId: tier?.id,
          tierLabel: tier?.label,
        ),
        paymentMethod: state.paymentMethod!,
        shopName: state.shopName,
        giftWrap: state.giftWrap,
        couponCode: state.couponRejected ? null : state.couponCode,
        orderNotes: state.orderNotes,
        personalisation: _personalisation(),
      ),
    );
    result.match(
      (failure) => switch (failure) {
        // Paid, not confirmed: lock checkout; the page clears the cart and
        // sends the customer to My Orders.
        final PaidButUnconfirmedFailure paid => emit(
          state.copyWith(placeStatus: ViewStatus.failure, paidNotice: paid.message),
        ),
        // Nothing was paid or placed: show the new price and wait for a
        // second press, which is priced against it.
        final PriceChangedFailure changed => emit(
          state.copyWith(
            placeStatus: ViewStatus.initial,
            estimateStatus: ViewStatus.success,
            quote: () => changed.quote,
            couponRejected:
                changed.reason == PriceChangeReason.couponRejected || state.couponRejected,
            errorMessage: _priceChangedMessage(changed),
          ),
        ),
        _ => emit(
          state.copyWith(
            placeStatus: ViewStatus.failure,
            errorMessage: failure.message,
            errorField: failure is ServerFailure ? failure.field : null,
          ),
        ),
      },
      (confirmation) {
        emit(state.copyWith(placeStatus: ViewStatus.success, confirmation: () => confirmation));
        _rememberUsed(state.address);
      },
    );
  }

  /// Keeps the address this order went to for next time. Never awaited and
  /// never reported: the success screen must not wait on it, and a failure
  /// here is not the customer's problem.
  void _rememberUsed(CheckoutAddress used) {
    final remember = _rememberAddress;
    if (remember == null) return;
    unawaited(
      Future(
        () => remember(SavedAddressMapper.fromCheckout(used)),
      ).then<void>((_) {}, onError: (Object _) {}),
    );
  }

  /// What "Personalise this gift" collected, the website's
  /// `collectPersonalisation()`: the tick stamped with the moment of the press.
  OrderPersonalisation _personalisation() {
    final name = state.senderName.trim();
    final phone = state.senderPhone.trim();
    return OrderPersonalisation(
      occasion: state.occasion,
      message: state.giftMessage,
      sender: name.isEmpty && phone.isEmpty
          ? null
          : OrderSender(name: name, phone: phone, hideFromRecipient: state.hideSender),
      termsAcceptedAt: state.termsAccepted ? isoInstant(_instant()) : null,
    );
  }

  /// [instant] as JavaScript's `toISOString()` writes it: UTC, milliseconds.
  static String isoInstant(DateTime instant) {
    final utc = instant.toUtc();
    String two(int value) => value.toString().padLeft(2, '0');
    final millis = utc.millisecond.toString().padLeft(3, '0');
    return '${utc.year.toString().padLeft(4, '0')}-${two(utc.month)}-${two(utc.day)}'
        'T${two(utc.hour)}:${two(utc.minute)}:${two(utc.second)}.${millis}Z';
  }

  /// The field a refusal over the consent tick names.
  static const String termsField = 'terms';

  String _priceChangedMessage(PriceChangedFailure failure) {
    final total = MoneyFormatter.format(failure.quote.totals.total, currency: state.currency);
    return '${failure.message} ${CheckoutStrings.newTotalPrefix}$total'
        '${CheckoutStrings.confirmPriceSuffix}';
  }

  /// Why the order cannot be placed yet (message, field), or null.
  (String, String)? _refusal() {
    // A closed shop takes nothing, whatever else is ready.
    final closed = state.maintenanceNotice;
    if (closed != null) return (closed, 'maintenance');
    final a = state.address;
    if (!_addressComplete(a)) return (CheckoutStrings.incompleteAddress, 'address');

    if (state.zonesRequired) {
      if (a.location == null) return (CheckoutStrings.needPin, 'location');
      final pin = state.pinResult;
      if (pin != null && !pin.isEligible) {
        return (pin.message ?? CheckoutStrings.pinNotEligible, 'location');
      }
    }
    if (state.tierRequired && state.tiers.isEmpty) {
      return (CheckoutStrings.noTiers, 'deliveryTierId');
    }
    if (state.tierRequired && state.tierId == null) {
      return (CheckoutStrings.needTier, 'deliveryTierId');
    }
    if (state.date == null) return (CheckoutStrings.needDate, 'deliverySlot.date');
    if (state.slotRequired && state.windows.isEmpty) {
      return (CheckoutStrings.noWindowsToday, 'deliverySlot.date');
    }
    if (state.slotRequired && state.timeSlot == null) {
      return (CheckoutStrings.needSlot, 'deliverySlot.timeSlot');
    }
    if (state.paymentMethod == null) return (CheckoutStrings.needPaymentMethod, 'paymentMethod');
    // The consent first, before the minimum and before anything is priced:
    // the order records `termsAcceptedAt` from it (checkout-page.tsx).
    if (!state.termsAccepted) return (CheckoutStrings.acceptTerms, termsField);
    if (state.belowMinimumOrder) {
      return (
        CheckoutStrings.minimumOrder(
          MoneyFormatter.format(state.minOrderValue, currency: state.currency),
        ),
        'minOrderValue',
      );
    }
    return null;
  }
}
