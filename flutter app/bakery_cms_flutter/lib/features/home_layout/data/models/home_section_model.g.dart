// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'home_section_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HomeSectionModel _$HomeSectionModelFromJson(Map<String, dynamic> json) => HomeSectionModel(
  id: JsonReaders.string(json['id']),
  type: JsonReaders.string(json['type']),
  background: JsonReaders.string(json['background']),
  overline: json['overline'] as String?,
  title: json['title'] as String?,
  description: json['description'] as String?,
  cta: HomeSectionModel._link(json['cta']),
  slides: json['slides'] == null ? const [] : HomeSectionModel._banners(json['slides']),
  items: json['items'] == null ? const [] : HomeSectionModel._maps(json['items']),
  categorySlugs: json['categorySlugs'] == null
      ? const []
      : JsonReaders.strings(json['categorySlugs']),
  productSlugs: json['productSlugs'] == null ? const [] : JsonReaders.strings(json['productSlugs']),
  tabs: json['tabs'] == null ? const [] : HomeSectionModel._tabs(json['tabs']),
  headline: json['headline'] as String?,
  cutoffTime: json['cutoffTime'] as String?,
  timezone: json['timezone'] as String?,
  layout: json['layout'] as String?,
  shape: json['shape'] as String?,
  maxCount: json['maxCount'] == null ? 0 : JsonReaders.toInt(json['maxCount']),
);
