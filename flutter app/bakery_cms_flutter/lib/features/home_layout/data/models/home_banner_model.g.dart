// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'home_banner_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HomeBannerModel _$HomeBannerModelFromJson(Map<String, dynamic> json) => HomeBannerModel(
  imageUrl: JsonReaders.string(json['imageUrl']),
  mobileImageUrl: json['mobileImageUrl'] as String?,
  title: json['title'] as String?,
  subtitle: json['subtitle'] as String?,
  ctaLabel: json['ctaLabel'] as String?,
  href: json['href'] as String?,
  imageAlt: json['imageAlt'] as String?,
  aspectRatio: JsonReaders.toDoubleOrNull(json['aspectRatio']),
  span: json['span'] == null ? 1 : JsonReaders.toInt(json['span']),
  badge: json['badge'] as String?,
  secondaryCtaLabel: json['secondaryCtaLabel'] as String?,
  secondaryHref: json['secondaryHref'] as String?,
);
