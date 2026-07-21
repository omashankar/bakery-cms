/**
 * Pre-paint blocking script for business type + optional modules — mirrors the
 * ThemeBlockingScript approach so non-bakery / module-off UI is hidden BEFORE the
 * first paint (no flash), without cookies or dynamic rendering.
 *
 * It reads the persisted settings from localStorage and stamps `data-*` attributes
 * on <html>. Global CSS (see globals.css) then hides elements marked with the
 * matching `data-gate-*` attribute. Bakery defaults set no attributes, so the
 * default template renders exactly as before.
 */
const SETTINGS_KEY = "bakery-cms-settings";

/**
 * Sets/removes the root `data-*` flags from a parsed settings object. Shared by
 * the inline string below (stringified) and the client live-sync — keep the two
 * in sync if you change the attribute names.
 */
export const BUSINESS_BLOCKING_SCRIPT = `(function(){var root=document.documentElement;function off(a){root.removeAttribute(a)}function set(a){root.setAttribute(a,"0")}try{var raw=localStorage.getItem("${SETTINGS_KEY}");var biz="bakery",m={};if(raw){var s=JSON.parse(raw);if(s&&s.general&&s.general.businessType)biz=s.general.businessType;if(s&&s.modules)m=s.modules}root.setAttribute("data-biz",biz);var wed=biz==="bakery"&&m.weddingBuilder!==false;wed?off("data-wed"):set("data-wed");m.flavour===false?set("data-mod-flavour"):off("data-mod-flavour");m.eggEggless===false?set("data-mod-egg"):off("data-mod-egg");m.weight===false?set("data-mod-weight"):off("data-mod-weight");m.shape===false?set("data-mod-shape"):off("data-mod-shape");m.photoCake===false?set("data-mod-photo"):off("data-mod-photo")}catch(e){}})();`;
