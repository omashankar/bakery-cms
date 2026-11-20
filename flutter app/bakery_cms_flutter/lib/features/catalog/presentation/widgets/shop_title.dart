import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../../store/presentation/bloc/store_config_cubit.dart';
import '../../../store/presentation/bloc/store_config_state.dart';

/// The shop's brand in a page's header, from its settings, as the website's
/// header draws it: the shop's own logo at its natural width when it has one
/// (the logo already carries the name), otherwise its small mark and name.
class ShopTitle extends StatelessWidget {
  const ShopTitle({super.key, this.centered = false});

  /// In the middle of its room (the cart's and checkout's header), rather
  /// than at its start.
  final bool centered;

  static const double markSize = 32;

  /// The logo's drawn height: most of the bar, as the website's 48px header
  /// logo, with a little air above and below.
  static const double logoHeight = 44;

  /// The widest the logo may draw, as a share of the title's room, so a very
  /// wide logo never pushes the header's icons off.
  static const double _logoMaxShare = 0.9;

  @override
  Widget build(BuildContext context) {
    return BlocSelector<StoreConfigCubit, StoreConfigState, (String, String, String)>(
      selector: (state) => (
        state.config?.siteName ?? AppStrings.appName,
        state.config?.logoUrl ?? '',
        state.config?.faviconUrl ?? '',
      ),
      builder: (context, shop) {
        final (name, logo, mark) = shop;
        final nameAndMark = _NameAndMark(name: name, mark: mark, centered: centered);
        if (logo.isEmpty) return nameAndMark;
        return LayoutBuilder(
          builder: (context, constraints) => Align(
            alignment: centered ? Alignment.center : AlignmentDirectional.centerStart,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: logoHeight,
                maxWidth: constraints.maxWidth * _logoMaxShare,
              ),
              child: Semantics(
                label: name,
                image: true,
                excludeSemantics: true,
                child: CachedNetworkImage(
                  imageUrl: AppNetworkImage.sizedUrl(logo, AppNetworkImage.thumbnailWidth),
                  height: logoHeight,
                  fit: BoxFit.contain,
                  alignment: centered ? Alignment.center : Alignment.centerLeft,
                  fadeInDuration: Duration.zero,
                  // The name, never a blank bar, while the logo arrives or
                  // if it cannot.
                  placeholder: (_, _) => nameAndMark,
                  errorWidget: (_, _, _) => nameAndMark,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// A shop without a logo: its small square mark, then its name.
class _NameAndMark extends StatelessWidget {
  const _NameAndMark({required this.name, required this.mark, required this.centered});

  final String name;
  final String mark;
  final bool centered;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: centered ? MainAxisSize.min : MainAxisSize.max,
      mainAxisAlignment: centered ? MainAxisAlignment.center : MainAxisAlignment.start,
      children: [
        if (mark.isNotEmpty) ...[
          SizedBox.square(
            dimension: ShopTitle.markSize,
            child: AppNetworkImage(
              url: mark,
              displayWidth: null,
              borderRadius: AppSpacing.radiusPill,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
        ],
        Flexible(child: _ShopName(name: name)),
      ],
    );
  }
}

/// The name is never cut ("Sweet Crumbs…" is not a brand): where it does not
/// fit on one line beside the header's icons, it sets smaller over two lines,
/// the way a stacked logo reads.
class _ShopName extends StatelessWidget {
  const _ShopName({required this.name});

  final String name;

  /// Line height of the two-line name, tight so both lines sit in the bar.
  static const double _stackedLineHeight = 1.15;

  @override
  Widget build(BuildContext context) {
    final oneLine = DefaultTextStyle.of(context).style;
    final stacked = (Theme.of(context).textTheme.titleMedium ?? oneLine).copyWith(
      color: oneLine.color,
      fontWeight: oneLine.fontWeight,
      height: _stackedLineHeight,
    );
    final scaler = MediaQuery.textScalerOf(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final painter = TextPainter(
          text: TextSpan(text: name, style: oneLine),
          maxLines: 1,
          textDirection: Directionality.of(context),
          textScaler: scaler,
        )..layout(maxWidth: constraints.maxWidth);
        final fits = !painter.didExceedMaxLines;
        painter.dispose();
        return fits
            ? Text(name, maxLines: 1, overflow: TextOverflow.ellipsis)
            : Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: stacked);
      },
    );
  }
}
