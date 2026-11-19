import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../cart/presentation/bloc/cart_cubit.dart';

/// Empties the cart when a customer's session ends on this phone.
///
/// The website's `clearLocalCustomerData` (apps/website/account/lib/
/// customer-session.ts) wipes, on sign-out, account deletion and a lapsed
/// session alike, everything the device holds on the customer's behalf:
///
/// - the cart (`bakery-cms-cart`) → here, through [CartCubit.clear], because
///   the cubit holds the lines in memory and a write behind its back would be
///   undone by its next save;
/// - the wishlist (`bakery-cms-wishlist`) → `WishlistRepositoryImpl` wipes
///   itself on the same signal;
/// - the address book cache → `AddressBookRepositoryImpl` drops its copy on
///   every change of customer; the book itself lives on the shop;
/// - checkout draft, held payment, verified-order grants, recent searches →
///   the app keeps none of these on the device.
///
/// Kept, as on the website: the delivery PIN code (`bakery-cms-delivery-
/// location`) and recently viewed products (`bakery-cms-recently-viewed`).
class SessionEndWiper extends StatefulWidget {
  const SessionEndWiper({super.key, required this.sessionEnded, required this.child});

  /// `WatchSessionEnded()`.
  final Stream<void> sessionEnded;
  final Widget child;

  @override
  State<SessionEndWiper> createState() => _SessionEndWiperState();
}

class _SessionEndWiperState extends State<SessionEndWiper> {
  StreamSubscription<void>? _subscription;

  @override
  void initState() {
    super.initState();
    _subscription = widget.sessionEnded.listen((_) => _wipe());
  }

  void _wipe() {
    if (!mounted) return;
    unawaited(context.read<CartCubit>().clear());
  }

  @override
  void dispose() {
    unawaited(_subscription?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
