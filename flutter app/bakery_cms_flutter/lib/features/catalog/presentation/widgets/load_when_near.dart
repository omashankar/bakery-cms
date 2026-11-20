import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// Calls [onNear] once, when [child] comes within a screen of being scrolled
/// into view — so a block below the fold (reviews, questions) asks the shop
/// for nothing until the customer is heading towards it, and never before
/// the page's first paint.
class LoadWhenNear extends StatefulWidget {
  const LoadWhenNear({super.key, required this.onNear, required this.child});

  final VoidCallback onNear;
  final Widget child;

  @override
  State<LoadWhenNear> createState() => _LoadWhenNearState();
}

class _LoadWhenNearState extends State<LoadWhenNear> {
  ScrollPosition? _position;
  bool _fired = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final position = Scrollable.maybeOf(context)?.position;
    if (position != _position) {
      _position?.removeListener(_check);
      _position = position?..addListener(_check);
    }
    // After this frame is laid out, never during it.
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  void _check() {
    if (_fired || !mounted) return;
    final box = context.findRenderObject();
    final position = _position;
    if (box == null || !box.attached) return;
    final viewport = RenderAbstractViewport.maybeOf(box);
    if (position == null || viewport == null || !position.hasViewportDimension) {
      _fire();
      return;
    }
    final top = viewport.getOffsetToReveal(box, 0).offset;
    // Within one more screen of the bottom edge.
    if (position.pixels + position.viewportDimension * 2 >= top) _fire();
  }

  void _fire() {
    _fired = true;
    _position?.removeListener(_check);
    widget.onNear();
  }

  @override
  void dispose() {
    _position?.removeListener(_check);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
