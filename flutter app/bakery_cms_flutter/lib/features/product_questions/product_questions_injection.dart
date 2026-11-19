import 'package:get_it/get_it.dart';

import 'data/datasources/product_questions_remote_data_source.dart';
import 'data/datasources/product_questions_remote_data_source_impl.dart';
import 'data/repositories/product_questions_repository_impl.dart';
import 'domain/repositories/product_questions_repository.dart';
import 'domain/usecases/ask_product_question.dart';
import 'domain/usecases/get_product_questions.dart';
import 'presentation/bloc/ask/ask_question_cubit.dart';
import 'presentation/bloc/questions/product_questions_cubit.dart';

void registerProductQuestionsFeature(GetIt sl) {
  sl
    ..registerLazySingleton<ProductQuestionsRemoteDataSource>(
      () => ProductQuestionsRemoteDataSourceImpl(sl()),
    )
    ..registerLazySingleton<ProductQuestionsRepository>(() => ProductQuestionsRepositoryImpl(sl()))
    ..registerLazySingleton(() => GetProductQuestions(sl()))
    ..registerLazySingleton(() => AskProductQuestion(sl()))
    ..registerFactory(() => ProductQuestionsCubit(sl()))
    ..registerFactory(() => AskQuestionCubit(sl()));
}
