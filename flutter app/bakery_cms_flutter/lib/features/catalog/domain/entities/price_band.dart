/// A price range in the listing's filter, by the card price. [min] is
/// included and [max] is not, so every price falls in exactly one band: a
/// ₹1,000 cake is in "₹1,000 – ₹2,000", a ₹2,000 one in "Above ₹2,000".
enum PriceBand {
  under500(max: 500),
  from500To1000(min: 500, max: 1000),
  from1000To2000(min: 1000, max: 2000),
  above2000(min: 2000);

  const PriceBand({this.min, this.max});

  final double? min;
  final double? max;

  bool contains(double price) {
    final low = min;
    final high = max;
    if (low != null && price < low) return false;
    if (high != null && price >= high) return false;
    return true;
  }
}
