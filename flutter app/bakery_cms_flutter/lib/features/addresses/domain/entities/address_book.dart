import 'package:equatable/equatable.dart';
import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../failures/address_book_full_failure.dart';
import '../failures/address_not_found_failure.dart';
import 'saved_address.dart';

/// The customer's whole book and its rules: at most [maxAddresses], and
/// exactly one default whenever it is not empty.
///
/// Every change returns a NEW book; the use cases save it whole, because the
/// shop replaces the book in one write.
class AddressBook extends Equatable {
  const AddressBook([this.addresses = const []]);

  /// The shop's own limit (`savedAddressesSchema`).
  static const int maxAddresses = 20;

  final List<SavedAddress> addresses;

  bool get isEmpty => addresses.isEmpty;

  bool get isFull => addresses.length >= maxAddresses;

  /// The default, or the first one if the book somehow has none.
  SavedAddress? get defaultAddress {
    for (final address in addresses) {
      if (address.isDefault) return address;
    }
    return addresses.isEmpty ? null : addresses.first;
  }

  /// Default first, then the most recently changed, as the website lists it.
  List<SavedAddress> get sorted {
    final list = [...addresses];
    final epoch = DateTime.fromMillisecondsSinceEpoch(0);
    list.sort((a, b) {
      if (a.isDefault != b.isDefault) return a.isDefault ? -1 : 1;
      return (b.updatedAt ?? epoch).compareTo(a.updatedAt ?? epoch);
    });
    return list;
  }

  SavedAddress? byId(String id) {
    for (final address in addresses) {
      if (address.id == id) return address;
    }
    return null;
  }

  /// An address already in the book for the same place as [candidate].
  SavedAddress? matching(SavedAddress candidate) {
    for (final address in addresses) {
      if (address.isSamePlaceAs(candidate)) return address;
    }
    return null;
  }

  /// Adds [address] (no id in the book yet) or replaces the one with its id.
  ///
  /// A new address that asks to be the default, or that is the book's first,
  /// becomes the only default. An edit never leaves the book without one.
  Either<Failure, AddressBook> upsert(SavedAddress address) {
    final index = addresses.indexWhere((existing) => existing.id == address.id);
    if (index < 0) {
      if (isFull) return const Left(AddressBookFullFailure());
      // Into an empty book, [_singleDefault] makes it the default anyway.
      final preferred = address.isDefault ? address.id : null;
      return Right(AddressBook(_singleDefault([...addresses, address], preferred)));
    }
    final wasDefault = addresses[index].isDefault;
    final next = [...addresses]..[index] = address;
    final preferred = address.isDefault ? address.id : null;
    final keepDefault = wasDefault && !address.isDefault ? address.id : preferred;
    return Right(AddressBook(_singleDefault(next, keepDefault)));
  }

  /// Removes the address with [id]. Removing the default hands it to the
  /// first one left.
  Either<Failure, AddressBook> remove(String id) {
    if (byId(id) == null) return const Left(AddressNotFoundFailure());
    final next = addresses.where((address) => address.id != id).toList();
    return Right(AddressBook(_singleDefault(next, null)));
  }

  /// Makes [id] the one default.
  Either<Failure, AddressBook> withDefault(String id) {
    if (byId(id) == null) return const Left(AddressNotFoundFailure());
    return Right(AddressBook(_singleDefault(addresses, id)));
  }

  /// Exactly one default: [preferredId] if given, else the first already
  /// marked, else the first in the list.
  static List<SavedAddress> _singleDefault(List<SavedAddress> list, String? preferredId) {
    if (list.isEmpty) return const [];
    var chosen = preferredId;
    if (chosen == null || !list.any((address) => address.id == chosen)) {
      chosen = list.firstWhere((address) => address.isDefault, orElse: () => list.first).id;
    }
    return [
      for (final address in list) address.copyWith(isDefault: address.id == chosen),
    ];
  }

  @override
  List<Object?> get props => [addresses];
}
