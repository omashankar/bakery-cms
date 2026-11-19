import 'dart:io';

import 'package:bakery_cms_flutter/features/catalog/domain/entities/photo_frame_shape.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/photo_print_draft.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/painting/canvas_photo_print_renderer.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

/// The print the shop receives: one JPEG at the website's size, white
/// outside the product's outline, the photo inside it.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory folder;
  late String source;

  setUp(() async {
    folder = await Directory.systemTemp.createTemp('photo-print-test');
    // A plain red photograph, wider than tall.
    final photo = img.Image(width: 600, height: 400)..clear(img.ColorRgb8(220, 0, 0));
    source = '${folder.path}/photo.png';
    await File(source).writeAsBytes(img.encodePng(photo));
  });

  tearDown(() => folder.delete(recursive: true));

  Future<img.Image> render(PhotoFrameShape shape, PhotoPrintDraft draft) async {
    final renderer = CanvasPhotoPrintRenderer(directory: () async => folder);
    final path = await renderer.render(sourcePath: source, shape: shape, draft: draft);
    final bytes = await File(path).readAsBytes();
    expect(path, endsWith('.jpg'));
    // A JPEG, by its magic bytes: what the website's `toBlob('image/jpeg')` sends.
    expect(bytes.sublist(0, 2), [0xFF, 0xD8]);
    return img.decodeJpg(bytes)!;
  }

  bool isWhite(img.Pixel p) => p.r > 240 && p.g > 240 && p.b > 240;
  bool isRed(img.Pixel p) => p.r > 180 && p.g < 60 && p.b < 60;

  test('a heart print is 2400 square, white at the corners and the notch, red inside', () async {
    final print = await render(PhotoFrameShape.heart, PhotoPrintDraft.empty);
    expect(print.width, 2400);
    expect(print.height, 2400);
    expect(isWhite(print.getPixel(5, 5)), isTrue, reason: 'outside the outline is not printed');
    expect(isWhite(print.getPixel(2394, 2394)), isTrue);
    expect(isWhite(print.getPixel(1200, 100)), isTrue, reason: 'the notch between the lobes');
    expect(isRed(print.getPixel(1200, 1200)), isTrue, reason: 'the photo fills the heart');
  });

  test('an upright print is 1800 × 2400 and a rectangle prints to its corners', () async {
    final print = await render(PhotoFrameShape.portrait, PhotoPrintDraft.empty);
    expect(print.width, 1800);
    expect(print.height, 2400);
    expect(isRed(print.getPixel(5, 5)), isTrue, reason: 'cover: the photo reaches every edge');
  });

  test('a round print is white at its corners', () async {
    final print = await render(PhotoFrameShape.circle, PhotoPrintDraft.empty);
    expect(print.width, 2400);
    expect(isWhite(print.getPixel(20, 20)), isTrue);
    expect(isRed(print.getPixel(1200, 1200)), isTrue);
  });

  test('the name is drawn into the print, where the draft puts it', () async {
    const name = PhotoPrintDraft(name: 'WWWWWW', colour: 0xFF000000, nameSize: 0.2, nameY: 0);
    final plain = await render(PhotoFrameShape.square, PhotoPrintDraft.empty);
    final lettered = await render(PhotoFrameShape.square, name);
    var dark = 0;
    for (var x = 900; x < 1500; x += 4) {
      final p = lettered.getPixel(x, 1200);
      if (p.r < 80 && p.g < 80 && p.b < 80) dark++;
    }
    expect(dark, greaterThan(10), reason: 'black lettering across the middle row');
    expect(isRed(plain.getPixel(1200, 1200)), isTrue);
  });
}
