import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../domain/entities/address_book.dart';
import '../../domain/repositories/address_book_repository.dart';
import '../datasources/address_book_remote_data_source.dart';
import '../models/saved_address_model.dart';

class AddressBookRepositoryImpl implements AddressBookRepository {
  /// [sessionChanges] fires whenever who is signed in changes; the copy is
  /// dropped then, so one customer never sees another's addresses.
  AddressBookRepositoryImpl(this._remote, {required Stream<Object?> sessionChanges}) {
    _sessionSubscription = sessionChanges.listen((_) => _cache = null);
  }

  final AddressBookRemoteDataSource _remote;
  late final StreamSubscription<Object?> _sessionSubscription;

  AddressBook? _cache;

  @override
  Future<Either<Failure, AddressBook>> load({bool forceRefresh = false}) => guard(() async {
        final cached = _cache;
        if (cached != null && !forceRefresh) return cached;
        return _cache = _toBook(await _remote.fetch());
      });

  @override
  Future<Either<Failure, AddressBook>> save(AddressBook book) => guard(() async {
        final stored = await _remote.replace(
          book.addresses.map(SavedAddressModel.fromEntity).toList(),
        );
        return _cache = _toBook(stored);
      });

  static AddressBook _toBook(List<SavedAddressModel> models) =>
      AddressBook(models.map((model) => model.toEntity()).toList());

  @visibleForTesting
  Future<void> dispose() => _sessionSubscription.cancel();
}
