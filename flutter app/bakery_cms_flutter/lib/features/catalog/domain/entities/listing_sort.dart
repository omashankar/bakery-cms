/// The orders a listing can be shown in. Applied by `ListingArranger` on the
/// products the app already holds; nothing is asked of the shop.
///
/// No "Newest": a product carries no creation date, so there is nothing
/// honest to sort by.
enum ListingSort { popularity, priceLowToHigh, priceHighToLow }
