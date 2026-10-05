/**
 * How many photos one product may carry.
 *
 * ONE number, read by the form that adds a box and by the validator that
 * refuses a save, because a cap enforced on only one side is not a cap: the
 * form would stop offering a fifth box while a direct POST still stored ten,
 * or the server would refuse a save the admin had no way to see coming.
 *
 * Four is the shop's choice, not a technical limit. Nothing in the storefront
 * breaks at five — the gallery's thumbnail rail renders whatever it is given.
 *
 * A product stored with MORE than this keeps them: the form shows every photo
 * it has so they can be looked at and removed, and refuses the save until the
 * count is down. Trimming the extras automatically would delete a photograph
 * the shop uploaded, silently, on a save it made for some other reason.
 */
export const MAX_PRODUCT_PHOTOS = 4;
