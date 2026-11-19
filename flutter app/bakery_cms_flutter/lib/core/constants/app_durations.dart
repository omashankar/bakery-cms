abstract final class AppDurations {
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);
  static const Duration snackbar = Duration(seconds: 3);

  /// Long enough to read the message AND reach its button ("View cart").
  static const Duration snackbarWithAction = Duration(seconds: 6);
  static const Duration searchDebounce = Duration(milliseconds: 350);

  /// How long typing in a PIN box must stop before its place is looked up.
  static const Duration pincodeLookup = Duration(milliseconds: 350);
  static const Duration resendCooldown = Duration(seconds: 30);
  static const Duration scrollToField = Duration(milliseconds: 350);

  /// How long a home hero slide stays before the next, and the turn itself.
  static const Duration heroSlide = Duration(seconds: 5);
  static const Duration slideTransition = Duration(milliseconds: 350);

  /// How often the same-day countdown redraws; it shows minutes, not seconds.
  static const Duration countdownTick = Duration(seconds: 30);

  /// An FAQ answer opening or closing.
  static const Duration accordion = Duration(milliseconds: 200);

  /// How long each word of the search box's turning hint stays.
  static const Duration searchHintTurn = Duration(seconds: 3);

  /// When a start-up load (shop settings, who is signed in) fails for want
  /// of a network, it is tried again after each of these, then left alone.
  /// Without it, an app opened offline never learned the shop's name or that
  /// the customer was still signed in, even after the network came back.
  static const List<Duration> backgroundRetries = [
    Duration(seconds: 3),
    Duration(seconds: 10),
    Duration(seconds: 30),
    Duration(seconds: 60),
  ];
}
