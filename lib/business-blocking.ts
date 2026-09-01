/**
 * Pre-paint blocking script for the optional modules — mirrors the
 * ThemeBlockingScript approach so module-off UI is hidden BEFORE the first paint
 * (no flash), without cookies or dynamic rendering.
 *
 * It reads the persisted settings from localStorage and stamps `data-*`
 * attributes on <html>. Global CSS (see globals.css) then hides elements marked
 * with the matching `data-gate-*` attribute.
 *
 * EVERY GATE HERE FAILS OPEN, and it has to. This runs before anything has been
 * fetched, so an empty localStorage — a first visit, a private window, cleared
 * site data — is the ordinary case, not the edge one. The wedding gate was
 * briefly `=== true`, which hid the nav item, the mobile nav, the footer link,
 * the FAQ entry and the search result from every new visitor of a shop that had
 * wedding switched ON, and made the homepage section unmount after hydration.
 * Absent means "not known yet", which may only ever mean "show it".
 *
 * `data-biz` was also stamped here and read by nothing — no CSS selector, no JS.
 * It went with the business type it named.
 */
const SETTINGS_KEY = "bakery-cms-settings";

/**
 * Sets/removes the root `data-*` flags from a parsed settings object. Shared by
 * the inline string below (stringified) and the client live-sync — keep the two
 * in sync if you change the attribute names.
 */
export const BUSINESS_BLOCKING_SCRIPT = `(function(){var root=document.documentElement;function off(a){root.removeAttribute(a)}function set(a){root.setAttribute(a,"0")}try{var raw=localStorage.getItem("${SETTINGS_KEY}");var m={};if(raw){var s=JSON.parse(raw);if(s&&s.modules)m=s.modules}m.weddingBuilder!==false?off("data-wed"):set("data-wed");m.flavour===false?set("data-mod-flavour"):off("data-mod-flavour");m.eggEggless===false?set("data-mod-egg"):off("data-mod-egg");m.weight===false?set("data-mod-weight"):off("data-mod-weight");m.shape===false?set("data-mod-shape"):off("data-mod-shape");m.photoCake===false?set("data-mod-photo"):off("data-mod-photo")}catch(e){}})();`;
