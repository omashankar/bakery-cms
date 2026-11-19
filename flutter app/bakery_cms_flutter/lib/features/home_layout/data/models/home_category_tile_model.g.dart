// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'home_category_tile_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HomeCategoryTileModel _$HomeCategoryTileModelFromJson(Map<String, dynamic> json) =>
    HomeCategoryTileModel(
      slug: JsonReaders.string(json['slug']),
      name: JsonReaders.string(json['name']),
      imageUrl: JsonReaders.string(json['imageUrl']),
      priceLabel: json['priceLabel'] as String?,
    );
