import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'app_network_image.dart';

/// A banner picture drawn whole, at its own shape: the box starts at
/// [fallbackAspect] and takes the picture's real width-over-height once it
/// has loaded (kept between [minAspect] and [maxAspect], so a stray portrait
/// upload cannot fill the screen). Artwork with its words in the picture is
/// never cropped this way, as on the website.
class NaturalAspectImage extends StatefulWidget {
  const NaturalAspectImage({
    super.key,
    required this.url,
    required this.fallbackAspect,
    required this.minAspect,
    required this.maxAspect,
    this.displayWidth = AppNetworkImage.fullWidth,
    this.borderRadius = 0,
  });

  final String url;
  final double fallbackAspect;
  final double minAspect;
  final double maxAspect;
  final int displayWidth;
  final double borderRadius;

  @override
  State<NaturalAspectImage> createState() => _NaturalAspectImageState();
}

class _NaturalAspectImageState extends State<NaturalAspectImage> {
  double? _measured;
  ImageStream? _stream;
  ImageStreamListener? _listener;

  @override
  void initState() {
    super.initState();
    _measure();
  }

  @override
  void didUpdateWidget(covariant NaturalAspectImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _forget();
      _measured = null;
      _measure();
    }
  }

  /// Reads the size from the same address (and cache) the picture loads.
  void _measure() {
    if (widget.url.isEmpty) return;
    final url = AppNetworkImage.sizedUrl(widget.url, widget.displayWidth);
    final stream = CachedNetworkImageProvider(url).resolve(ImageConfiguration.empty);
    final listener = ImageStreamListener((info, _) {
      final ratio = info.image.width / info.image.height;
      if (mounted && ratio.isFinite && ratio > 0) setState(() => _measured = ratio);
      _forget();
    }, onError: (_, _) => _forget());
    _stream = stream..addListener(listener);
    _listener = listener;
  }

  void _forget() {
    final listener = _listener;
    if (listener != null) _stream?.removeListener(listener);
    _stream = null;
    _listener = null;
  }

  @override
  void dispose() {
    _forget();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final aspect = (_measured ?? widget.fallbackAspect).clamp(widget.minAspect, widget.maxAspect);
    return AspectRatio(
      aspectRatio: aspect,
      child: AppNetworkImage(
        url: widget.url,
        fit: BoxFit.contain,
        displayWidth: widget.displayWidth,
        borderRadius: widget.borderRadius,
      ),
    );
  }
}
