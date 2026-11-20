import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_durations.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/context_extensions.dart';

/// A search box that opens the search screen when tapped.
///
/// With [hintWords] (the shop's own category and occasion names) the hint
/// turns through "Search for Cakes", "Search for Birthday", ... every
/// [AppDurations.searchHintTurn]. Without them, or when the phone asks for
/// reduced motion, it is the fixed [CatalogStrings.searchHint]. The turning
/// stops while the box is off screen (another tab, a pushed page) or the app
/// is in the background.
class SearchEntryBar extends StatefulWidget {
  const SearchEntryBar({super.key, this.hintWords = const []});

  /// At most this many words take turns.
  static const int maxHintWords = 12;

  final List<String> hintWords;

  /// [hintWords] trimmed, without blanks or repeats, capped.
  @visibleForTesting
  static List<String> wordsOf(List<String> hintWords) {
    final seen = <String>{};
    return [
      for (final word in hintWords.map((w) => w.trim()))
        if (word.isNotEmpty && seen.add(word.toLowerCase())) word,
    ].take(maxHintWords).toList();
  }

  @override
  State<SearchEntryBar> createState() => _SearchEntryBarState();
}

class _SearchEntryBarState extends State<SearchEntryBar> {
  late List<String> _words = SearchEntryBar.wordsOf(widget.hintWords);
  late final AppLifecycleListener _lifecycle;
  Timer? _timer;
  int _turn = 0;
  bool _onScreen = true;
  bool _stillMotion = false;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(onStateChange: (_) => _sync());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Both are dependencies: a change rebuilds this and re-decides the timer.
    _onScreen = TickerMode.of(context);
    _stillMotion = MediaQuery.disableAnimationsOf(context);
    _sync();
  }

  @override
  void didUpdateWidget(SearchEntryBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    final words = SearchEntryBar.wordsOf(widget.hintWords);
    if (words.join('\u0000') == _words.join('\u0000')) return;
    _words = words;
    _turn = 0;
    _sync();
  }

  bool get _turning =>
      _words.length > 1 &&
      _onScreen &&
      !_stillMotion &&
      WidgetsBinding.instance.lifecycleState != AppLifecycleState.paused &&
      WidgetsBinding.instance.lifecycleState != AppLifecycleState.hidden;

  /// Starts or stops the timer to match whether the hint should turn.
  void _sync() {
    if (_turning) {
      _timer ??= Timer.periodic(AppDurations.searchHintTurn, (_) {
        if (mounted) setState(() => _turn = (_turn + 1) % _words.length);
      });
    } else {
      _timer?.cancel();
      _timer = null;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _lifecycle.dispose();
    super.dispose();
  }

  String get _hint => _words.isEmpty || _stillMotion
      ? CatalogStrings.searchHint
      : '${CatalogStrings.searchForPrefix} ${_words[_turn % _words.length]}';

  @override
  Widget build(BuildContext context) {
    final style = context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant);
    final hint = _hint;
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 0),
      child: Material(
        color: context.colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          onTap: () => context.push(AppRoutes.search),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                Icon(Icons.search, color: context.colors.onSurfaceVariant),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  // One label for a screen reader, not a new one every turn.
                  child: Semantics(
                    label: CatalogStrings.searchTitle,
                    button: true,
                    excludeSemantics: true,
                    child: AnimatedSwitcher(
                      duration: AppDurations.slideTransition,
                      layoutBuilder: (current, previous) => Stack(
                        alignment: AlignmentDirectional.centerStart,
                        children: [...previous, ?current],
                      ),
                      child: Text(
                        hint,
                        key: ValueKey(hint),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: style,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
