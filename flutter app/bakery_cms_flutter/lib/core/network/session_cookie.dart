/// The shop's customer sign-in cookie.
///
/// `CUSTOMER_COOKIE` in the backend's lib/server/auth/cookies.ts. The app
/// never reads its value (it is httpOnly on the web, and opaque here); only
/// whether the cookie jar still holds one, to tell a session that has lapsed
/// from a visitor who never signed in.
abstract final class SessionCookie {
  static const String name = 'customer_session';
}
