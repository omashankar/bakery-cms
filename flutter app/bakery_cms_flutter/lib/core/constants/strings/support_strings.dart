/// Copy for Help & support: contact, FAQ and the shop's pages. Mirrors the
/// website's /store/contact, /store/faq, /store/thank-you and its sign-in
/// terms line, word for word where the website has words.
abstract final class SupportStrings {
  // Account section
  static const String sectionTitle = 'Help & support';
  static const String contactTile = 'Contact us';
  static const String contactTileHint = 'Send the shop a message';
  static const String faqTile = 'FAQs';
  static const String faqTileHint = 'Answers to common questions';
  static const String privacyTile = 'Privacy Policy';
  static const String termsTile = 'Terms of Service';

  // Contact page
  static const String contactTitle = 'Contact Us';
  static const String formTitle = 'Send us a message';
  static const String formIntro =
      'Fill in the details below and our team will get back to you within 24 hours.';
  static const String nameLabel = 'Full Name';
  static const String nameHint = 'Your full name';
  static const String phoneLabel = 'Phone';
  static const String phoneHint = '+91';
  static const String emailLabel = 'Email';
  static const String emailHint = 'you@example.com';
  static const String subjectLabel = 'Subject';
  static const String subjectHint = 'Order inquiry, custom order, etc.';
  static const String messageLabel = 'Message';
  static const String messageHint = 'Tell us about your order or requirement...';
  static const String submit = 'Submit Inquiry';
  static const String sendFailed =
      "We couldn't send your message. Please check your connection and try again.";

  static const String getInTouch = 'Get in Touch';
  static const String visitUs = 'Visit us';
  static const String callUs = 'Call us';
  static const String emailUs = 'Email us';
  static const String openingHours = 'Opening Hours';
  static const String copied = 'Copied';
  static const String copyHint = 'Tap to copy';
  static const String tapToCall = 'Tap to call';
  static const String tapToEmail = 'Tap to email';

  /// No dialer or mail app took the link, so the value was copied instead.
  static const String copiedNoApp = 'No app could open it, so it was copied';

  // Sent (the website's thank-you page)
  static const String sentTitle = 'Thank You!';
  static const String sentMessage =
      'Your inquiry has been submitted successfully. Our team will get back to you within '
      '24 hours.';
  static const String backToHome = 'Back to Home';
  static const String browseProducts = 'Browse products';

  // FAQ page
  static const String faqTitle = 'Frequently Asked Questions';
  static const String faqSearchHint = 'Search FAQ...';
  static const String faqAll = 'All';
  static const String faqGeneral = 'General';
  static const String faqOrders = 'Orders';
  static const String faqWedding = 'Wedding';
  static const String faqDelivery = 'Delivery';
  static const String faqNoMatch = 'No matching questions found.';
  static const String faqEmpty = 'No questions have been published yet.';
  static String faqShowing(String category) => 'Showing $category questions';
  static const String stillHaveQuestions = 'Still have questions?';
  static const String stillHaveQuestionsBody =
      "Can't find what you're looking for? Our friendly team is happy to help with orders, "
      'custom designs, and delivery.';
  static const String contactSupport = 'Contact Support';

  // Shop pages
  static const String pageNotFoundTitle = 'Page not available';
  static const String pageNotFoundMessage =
      'This page is not available or has not been published yet.';
  static const String pageEmpty = 'This page has no content yet.';

  // Sign-in terms line
  static const String agreePrefix = 'By continuing, you agree to our ';
  static const String agreeJoin = ' and ';
}
