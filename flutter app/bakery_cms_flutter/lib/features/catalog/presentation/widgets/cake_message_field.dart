import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../domain/entities/product_selection.dart';
import '../bloc/product_detail/product_detail_cubit.dart';

class CakeMessageField extends StatelessWidget {
  const CakeMessageField({super.key});

  @override
  Widget build(BuildContext context) {
    return AppTextField(
      label: CatalogStrings.messageOnCake,
      hint: CatalogStrings.messageHint,
      maxLength: ProductSelection.maxMessageLength,
      textCapitalization: TextCapitalization.sentences,
      onChanged: context.read<ProductDetailCubit>().setMessage,
    );
  }
}
