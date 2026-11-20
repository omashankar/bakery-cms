import 'package:equatable/equatable.dart';

/// Where the customer put their photo and their name inside the frame.
///
/// The website's `PhotoPrintDraft` (`lib/images/photo-print-layout.ts`),
/// field for field, so the same slider positions print the same file.
class PhotoPrintDraft extends Equatable {
  const PhotoPrintDraft({
    this.zoom = 1,
    this.offsetX = 0,
    this.offsetY = 0,
    this.rotation = 0,
    this.name = '',
    this.nameSize = 0.11,
    this.nameX = 0,
    this.nameY = 0.35,
    this.nameRotation = 0,
    this.bold = true,
    this.italic = false,
    this.colour = defaultColour,
  });

  /// `#8b4513`, the website's starting lettering colour, as ARGB.
  static const int defaultColour = 0xFF8B4513;

  /// The website's `emptyPhotoPrintDraft`: the photo filling the frame, the
  /// lettering in the lower third rather than across the face.
  static const PhotoPrintDraft empty = PhotoPrintDraft();

  /// 1 fills the frame exactly; above that, closer in.
  final double zoom;

  /// −1 … 1, as a fraction of half the frame.
  final double offsetX;
  final double offsetY;

  /// Degrees.
  final double rotation;
  final String name;

  /// Height of the lettering, as a fraction of the frame's short side.
  final double nameSize;
  final double nameX;
  final double nameY;
  final double nameRotation;
  final bool bold;
  final bool italic;

  /// The lettering's colour, ARGB.
  final int colour;

  /// A new photograph starts square on: zoom, pan and turn describe the last
  /// picture. The name and its styling are kept, because they are about the
  /// order rather than the file (the website's `choose`).
  PhotoPrintDraft forNewPhoto() => copyWith(
    zoom: empty.zoom,
    offsetX: empty.offsetX,
    offsetY: empty.offsetY,
    rotation: empty.rotation,
  );

  /// "Start again": everything back as it started, except the name.
  PhotoPrintDraft startAgain() => empty.copyWith(name: name);

  PhotoPrintDraft copyWith({
    double? zoom,
    double? offsetX,
    double? offsetY,
    double? rotation,
    String? name,
    double? nameSize,
    double? nameX,
    double? nameY,
    double? nameRotation,
    bool? bold,
    bool? italic,
    int? colour,
  }) {
    return PhotoPrintDraft(
      zoom: zoom ?? this.zoom,
      offsetX: offsetX ?? this.offsetX,
      offsetY: offsetY ?? this.offsetY,
      rotation: rotation ?? this.rotation,
      name: name ?? this.name,
      nameSize: nameSize ?? this.nameSize,
      nameX: nameX ?? this.nameX,
      nameY: nameY ?? this.nameY,
      nameRotation: nameRotation ?? this.nameRotation,
      bold: bold ?? this.bold,
      italic: italic ?? this.italic,
      colour: colour ?? this.colour,
    );
  }

  @override
  List<Object?> get props => [
    zoom,
    offsetX,
    offsetY,
    rotation,
    name,
    nameSize,
    nameX,
    nameY,
    nameRotation,
    bold,
    italic,
    colour,
  ];
}
