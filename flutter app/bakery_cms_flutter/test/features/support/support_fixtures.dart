import 'dart:convert';
import 'dart:io';

/// The `data` of a response captured from the running shop (GET only).
Object? liveData(String fixture) {
  final body = jsonDecode(File('test/fixtures/$fixture').readAsStringSync());
  return (body as Map<String, dynamic>)['data'];
}
