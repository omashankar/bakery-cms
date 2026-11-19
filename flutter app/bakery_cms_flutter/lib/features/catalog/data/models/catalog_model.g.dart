// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'catalog_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CatalogModel _$CatalogModelFromJson(Map<String, dynamic> json) => CatalogModel(
  categories:
      (json['categories'] as List<dynamic>?)
          ?.map((e) => ProductGroupModel.fromJson(e as Map<String, dynamic>))
          .toList() ??
      [],
  occasions:
      (json['occasions'] as List<dynamic>?)
          ?.map((e) => ProductGroupModel.fromJson(e as Map<String, dynamic>))
          .toList() ??
      [],
  collections:
      (json['collections'] as List<dynamic>?)
          ?.map((e) => ProductGroupModel.fromJson(e as Map<String, dynamic>))
          .toList() ??
      [],
);
