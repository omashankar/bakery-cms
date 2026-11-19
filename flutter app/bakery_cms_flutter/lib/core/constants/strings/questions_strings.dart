/// Copy for the product page's "Questions and Answers" block and the ask
/// form, worded as the website words them (`product-detail-page.tsx`,
/// `product-question-form.tsx`).
abstract final class QuestionsStrings {
  static const String title = 'Questions and Answers';
  static const String answeredQuestion = 'answered question';
  static const String answeredQuestions = 'answered questions';
  static const String askTheShop = 'Ask the shop about this product';
  static const String beFirst = 'Be the first to ask about this product';
  static const String loading = 'Loading questions…';
  static const String loadFailed = 'Questions could not be loaded.';
  static const String retry = 'Try again';
  static const String questionPrefix = 'Q:';
  static const String answerPrefix = 'A:';
  static const String askedBy = 'Asked by';
  static const String answered = 'answered';
  static const String askAQuestion = 'Ask a question';

  // The form
  static const String formTitle = 'Ask about this — the shop replies by email';
  static const String formName = 'Your name';
  static const String formEmail = 'Email';
  static const String formQuestion = 'Your question';
  static const String formSend = 'Send question';
  static const String formSending = 'Sending…';
  static const String formMissing = 'Please add your name, email and question';
  static const String formBadEmail = 'Please enter a valid email';
  static const String formFailed = 'Could not send your question. Please try again.';
  static const String formSent = 'Question sent. The shop will reply to you by email.';

  /// The enquiry's subject, before the product's name (`Question about …`).
  static const String subjectPrefix = 'Question about';
}
