import '../constants/app_strings.dart';

/// Form validators that match what the shop's API accepts, so a form refuses
/// locally what the server would refuse anyway.
///
/// Each returns null when the value is fine, or the message to show.
abstract final class Validators {
  static final RegExp _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  /// An Indian mobile, written any of the usual ways: 98765 43210,
  /// 09876543210, 919876543210 or +91 98765 43210. The leading 0 matters:
  /// customers' saved numbers carry it, and refusing it blocked their own
  /// checkout.
  static final RegExp _phone = RegExp(r'^(?:\+?91|0)?[6-9]\d{9}$');
  static final RegExp _pincode = RegExp(r'^[1-9]\d{5}$');
  static final RegExp _otp = RegExp(r'^\d{6}$');
  static final RegExp _spaces = RegExp(r'[\s-]');

  static String? required(String? value) =>
      (value == null || value.trim().isEmpty) ? AppStrings.validationRequired : null;

  static String? email(String? value) {
    final missing = required(value);
    if (missing != null) return missing;
    return _email.hasMatch(value!.trim()) ? null : AppStrings.validationEmail;
  }

  static String? phone(String? value) {
    final missing = required(value);
    if (missing != null) return missing;
    return _phone.hasMatch(value!.replaceAll(_spaces, '')) ? null : AppStrings.validationPhone;
  }

  static String? pincode(String? value) {
    final missing = required(value);
    if (missing != null) return missing;
    return _pincode.hasMatch(value!.trim()) ? null : AppStrings.validationPincode;
  }

  static String? otp(String? value) {
    final missing = required(value);
    if (missing != null) return missing;
    return _otp.hasMatch(value!.trim()) ? null : AppStrings.validationOtp;
  }
}
