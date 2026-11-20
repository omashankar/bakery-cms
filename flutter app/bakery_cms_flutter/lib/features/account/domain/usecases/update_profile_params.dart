import 'package:equatable/equatable.dart';

class UpdateProfileParams extends Equatable {
  const UpdateProfileParams({required this.name, this.phone});

  final String name;
  final String? phone;

  @override
  List<Object?> get props => [name, phone];
}
