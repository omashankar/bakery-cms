import 'package:equatable/equatable.dart';

import '../../../../../core/utils/view_status.dart';

/// The ask form: initial (being filled in) → loading (sending) → success
/// (sent; the shop replies by email) | failure (not sent, form kept).
class AskQuestionState extends Equatable {
  const AskQuestionState({
    this.status = ViewStatus.initial,
    this.name = '',
    this.email = '',
    this.question = '',
    this.errorMessage,
    this.sent = 0,
  });

  final ViewStatus status;
  final String name;
  final String email;
  final String question;
  final String? errorMessage;

  /// How many questions this form has sent: each one clears the box.
  final int sent;

  AskQuestionState copyWith({
    ViewStatus? status,
    String? name,
    String? email,
    String? question,
    String? errorMessage,
  }) => AskQuestionState(
    status: status ?? this.status,
    name: name ?? this.name,
    email: email ?? this.email,
    question: question ?? this.question,
    errorMessage: errorMessage,
    sent: sent,
  );

  @override
  List<Object?> get props => [status, name, email, question, errorMessage, sent];
}
