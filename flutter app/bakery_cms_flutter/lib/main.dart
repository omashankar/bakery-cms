import 'package:flutter/material.dart';

import 'app/app.dart';
import 'app/di/injection.dart';
import 'core/utils/app_error_handler.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppErrorHandler.install();
  await configureDependencies();
  runApp(const App());
}
