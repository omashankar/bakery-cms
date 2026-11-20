// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_question_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProductQuestionModel _$ProductQuestionModelFromJson(Map<String, dynamic> json) =>
    ProductQuestionModel(
      id: JsonReaders.string(json['id']),
      name: JsonReaders.string(json['name']),
      message: JsonReaders.string(json['message']),
      answer: JsonReaders.string(json['answer']),
      answeredAt: json['answeredAt'] as String?,
    );
