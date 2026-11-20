/// Copy for the sign-in screens.
abstract final class AuthStrings {
  static const String title = 'Sign in';
  static const String headline = 'Sign in or create an account';
  static const String intro =
      'Enter your email and we will send you a 6-digit code. No password needed.';
  static const String emailLabel = 'Email';
  static const String emailHint = 'you@example.com';
  static const String nameLabel = 'Your name (optional)';
  static const String nameHint = 'Used if this is your first order';
  static const String sendCode = 'Send code';

  static const String codeHeadline = 'Check your email';
  static String codeSentTo(String email) => 'We sent a 6-digit code to $email.';
  static const String codeLabel = '6-digit code';
  static const String verify = 'Verify and continue';
  static const String resend = 'Resend code';
  static String resendIn(int seconds) => 'Resend code in ${seconds}s';
  static const String changeEmail = 'Use a different email';
  static const String codeSent = 'A new code is on its way.';
  static const String signedIn = 'You are signed in.';
}
