import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../domain/entities/geo_point.dart';
import '../bloc/map_picker_cubit.dart';
import '../widgets/map_picker_view.dart';

/// Drop a pin on the door. Pops with the chosen [GeoPoint], or null if the
/// customer backs out.
///
/// Opened with nothing known, it centres on the device if location was
/// allowed before (it never asks by itself); otherwise it starts on [initial].
class MapPickerPage extends StatelessWidget {
  const MapPickerPage({super.key, this.initial});

  final GeoPoint? initial;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) {
        final cubit = GetIt.I<MapPickerCubit>(param1: initial);
        if (initial == null) cubit.locateIfAllowed();
        return cubit;
      },
      child: const Scaffold(
        appBar: AppAppBar(title: CheckoutStrings.mapTitle),
        body: MapPickerView(),
      ),
    );
  }
}
