// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'faq_item_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FaqItemModel _$FaqItemModelFromJson(Map<String, dynamic> json) => FaqItemModel(
  id: JsonReaders.string(json['id']),
  question: JsonReaders.string(json['question']),
  answer: JsonReaders.string(json['answer']),
  category: JsonReaders.string(json['category']),
  status: JsonReaders.string(json['status']),
  sortOrder: JsonReaders.toInt(json['sortOrder']),
);
