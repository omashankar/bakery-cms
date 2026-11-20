import 'dart:ui' as ui;

import 'package:bakery_cms_flutter/core/constants/strings/catalog_strings.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/photo_print_draft.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/photo_print_editor/photo_print_editor_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/painting/photo_image_decoder.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockDecoder extends Mock implements PhotoImageDecoder {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const path = '/cache/photo.jpg';
  late _MockDecoder decoder;

  setUp(() => decoder = _MockDecoder());

  Future<ui.Image> image() => createTestImage(width: 8, height: 6);

  PhotoPrintEditorCubit build([PhotoPrintDraft draft = PhotoPrintDraft.empty]) =>
      PhotoPrintEditorCubit(sourcePath: path, draft: draft, decoder: decoder);

  test('opens the photo: loading, then success with the picture', () async {
    final picture = await image();
    when(() => decoder.sizeOf(path)).thenAnswer((_) async => 2048);
    when(() => decoder.decode(path)).thenAnswer((_) async => picture);
    final cubit = build();
    final states = <ViewStatus>[];
    final sub = cubit.stream.listen((s) => states.add(s.status));
    await cubit.open();
    await Future<void>.delayed(Duration.zero);
    expect(states, [ViewStatus.loading, ViewStatus.success]);
    expect(cubit.state.image, same(picture));
    expect(cubit.state.canUse, isTrue);
    await sub.cancel();
    await cubit.close();
  });

  test('a file over 20 MB is refused before it is decoded', () async {
    when(() => decoder.sizeOf(path)).thenAnswer((_) async => 21 * 1024 * 1024);
    final cubit = build();
    await cubit.open();
    expect(cubit.state.status, ViewStatus.failure);
    expect(cubit.state.errorMessage, CatalogStrings.printTooLarge);
    expect(cubit.state.canUse, isFalse);
    verifyNever(() => decoder.decode(any()));
    await cubit.close();
  });

  test('a photo that will not open says so, and cannot be used', () async {
    when(() => decoder.sizeOf(path)).thenAnswer((_) async => 10);
    when(() => decoder.decode(path)).thenThrow(Exception('not an image'));
    final cubit = build();
    await cubit.open();
    expect(cubit.state.status, ViewStatus.failure);
    expect(cubit.state.errorMessage, CatalogStrings.printOpenFailed);
    expect(cubit.state.canUse, isFalse);
    await cubit.close();
  });

  test('moves are kept; start again keeps only the name; the panel switches', () async {
    final cubit = build(const PhotoPrintDraft(name: 'Riya'));
    cubit.update(cubit.state.draft.copyWith(zoom: 2.5, rotation: 30));
    expect(cubit.state.draft.zoom, 2.5);
    cubit.startAgain();
    expect(cubit.state.draft, const PhotoPrintDraft(name: 'Riya'));
    cubit.showNamePanel(true);
    expect(cubit.state.namePanel, isTrue);
    await cubit.close();
  });
}
