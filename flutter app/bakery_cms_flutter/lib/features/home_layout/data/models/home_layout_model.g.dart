// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'home_layout_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HomeLayoutModel _$HomeLayoutModelFromJson(Map<String, dynamic> json) => HomeLayoutModel(
  updatedAt: JsonReaders.string(json['updatedAt']),
  sections: HomeLayoutModel._sections(json['sections']),
  menu: json['menu'] == null ? const [] : HomeLayoutModel._menu(json['menu']),
);
