import '../models/home_layout_model.dart';

/// Throws the app's typed exceptions; never returns a failure.
abstract interface class HomeLayoutRemoteDataSource {
  Future<HomeLayoutModel> fetchHomeLayout();
}
