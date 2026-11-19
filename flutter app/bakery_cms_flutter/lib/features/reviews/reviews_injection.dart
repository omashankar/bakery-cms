import 'package:get_it/get_it.dart';

import 'data/datasources/review_votes_local_data_source.dart';
import 'data/datasources/review_votes_local_data_source_impl.dart';
import 'data/datasources/reviews_remote_data_source.dart';
import 'data/datasources/reviews_remote_data_source_impl.dart';
import 'data/repositories/reviews_repository_impl.dart';
import 'domain/repositories/reviews_repository.dart';
import 'domain/usecases/get_product_reviews.dart';
import 'domain/usecases/get_review_votes.dart';
import 'domain/usecases/submit_review.dart';
import 'domain/usecases/vote_on_review.dart';
import 'presentation/bloc/review_form/review_form_cubit.dart';
import 'presentation/bloc/reviews/reviews_cubit.dart';

/// Needs SharedPreferences, the photo picker and the catalog's photo upload
/// registered first (review photos go through the same upload).
void registerReviewsFeature(GetIt sl) {
  sl
    ..registerLazySingleton<ReviewsRemoteDataSource>(() => ReviewsRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<ReviewVotesLocalDataSource>(() => ReviewVotesLocalDataSourceImpl(sl()))
    ..registerLazySingleton<ReviewsRepository>(() => ReviewsRepositoryImpl(sl(), sl()))
    ..registerLazySingleton(() => GetProductReviews(sl()))
    ..registerLazySingleton(() => GetReviewVotes(sl()))
    ..registerLazySingleton(() => SubmitReview(sl()))
    ..registerLazySingleton(() => VoteOnReview(sl()))
    ..registerFactory(() => ReviewsCubit(sl(), sl(), sl()))
    ..registerFactory(() => ReviewFormCubit(sl(), sl(), sl()));
}
