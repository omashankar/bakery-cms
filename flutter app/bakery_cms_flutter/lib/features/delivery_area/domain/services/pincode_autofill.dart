/// How a PIN's place goes into an address form: into the boxes left EMPTY,
/// never over what the customer typed (the website's checkout and address
/// book both: "Filled in, never typed over").
abstract final class PincodeAutofill {
  /// [typed] when the customer wrote anything there, otherwise [found].
  static String keep(String typed, String found) => typed.trim().isEmpty ? found.trim() : typed;
}
