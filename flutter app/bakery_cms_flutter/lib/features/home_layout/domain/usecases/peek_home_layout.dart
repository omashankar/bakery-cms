import '../entities/home_layout.dart';
import '../repositories/home_layout_repository.dart';

/// The home page already loaded this session, or null. Synchronous and never
/// a request, so a screen can draw a picture from the home page without
/// waiting on it.
class PeekHomeLayout {
  const PeekHomeLayout(this._repository);

  final HomeLayoutRepository _repository;

  HomeLayout? call() => _repository.cached;
}
