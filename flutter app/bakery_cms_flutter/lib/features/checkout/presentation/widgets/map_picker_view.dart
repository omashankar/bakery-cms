import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../domain/entities/geo_point.dart';
import '../bloc/map_picker_cubit.dart';
import '../bloc/map_picker_state.dart';
import 'map_pin.dart';

/// An OpenStreetMap with a pin at its centre. Dragging moves the map under
/// the pin; tapping jumps the pin to the tapped point.
class MapPickerView extends StatefulWidget {
  const MapPickerView({super.key});

  static const String _tiles = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  static const String _userAgent = 'in.sweetcrumbs.app';
  static const double _zoom = 16;
  static const double _locatedZoom = 17;

  @override
  State<MapPickerView> createState() => _MapPickerViewState();
}

class _MapPickerViewState extends State<MapPickerView> {
  final MapController _map = MapController();

  @override
  void dispose() {
    _map.dispose();
    super.dispose();
  }

  static LatLng _latLng(GeoPoint point) => LatLng(point.lat, point.lng);

  static GeoPoint _geo(LatLng point) => GeoPoint(lat: point.latitude, lng: point.longitude);

  void _tapped(LatLng point) {
    _map.move(point, _map.camera.zoom);
    context.read<MapPickerCubit>().moved(_geo(point));
  }

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<MapPickerCubit>();
    return MultiBlocListener(
      listeners: [
        BlocListener<MapPickerCubit, MapPickerState>(
          listenWhen: (previous, current) => previous.recenterId != current.recenterId,
          listener: (context, state) =>
              _map.move(_latLng(state.center), MapPickerView._locatedZoom),
        ),
        BlocListener<MapPickerCubit, MapPickerState>(
          listenWhen: (previous, current) =>
              current.errorMessage != null && previous.errorMessage != current.errorMessage,
          listener: (context, state) => AppSnackbar.error(context, state.errorMessage!),
        ),
      ],
      child: Stack(
        children: [
          FlutterMap(
            mapController: _map,
            options: MapOptions(
              initialCenter: _latLng(cubit.state.center),
              initialZoom: MapPickerView._zoom,
              onTap: (_, point) => _tapped(point),
              onPositionChanged: (camera, hasGesture) {
                if (hasGesture) cubit.moved(_geo(camera.center));
              },
            ),
            children: [
              TileLayer(
                urlTemplate: MapPickerView._tiles,
                userAgentPackageName: MapPickerView._userAgent,
              ),
              const RichAttributionWidget(
                attributions: [TextSourceAttribution(CheckoutStrings.mapAttribution)],
              ),
            ],
          ),
          const MapPin(),
          Positioned(
            top: AppSpacing.md,
            left: AppSpacing.md,
            right: AppSpacing.md,
            child: AppCard(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Text(CheckoutStrings.mapHint, style: context.text.bodyMedium),
            ),
          ),
          Positioned(
            left: AppSpacing.lg,
            right: AppSpacing.lg,
            bottom: AppSpacing.xxxl,
            child: SafeArea(
              top: false,
              child: BlocBuilder<MapPickerCubit, MapPickerState>(
                buildWhen: (previous, current) =>
                    previous.locateStatus != current.locateStatus ||
                    previous.center != current.center,
                builder: (context, state) => Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DecoratedBox(
                      decoration: BoxDecoration(
                        color: context.colors.surface,
                        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                      ),
                      child: AppButton.secondary(
                        label: CheckoutStrings.useMyLocation,
                        icon: Icons.my_location,
                        isLoading: state.locateStatus.isLoading,
                        onPressed: cubit.locate,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    AppButton(
                      label: CheckoutStrings.confirmLocation,
                      onPressed: () => context.pop(state.center),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
