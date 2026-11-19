/// What the shop's API calls `addressLabel`.
enum AddressLabel {
  home('Home'),
  office('Office'),
  other('Other');

  const AddressLabel(this.apiValue);

  final String apiValue;
}
