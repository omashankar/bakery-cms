import { LayoutTemplate, Package, ShieldCheck, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { optimizedImageUrl } from "@/lib/image-url";

interface AuthLayoutShellProps {
  children: React.ReactNode;
  /**
   * The shop's name. Empty when the settings read failed — the shell then says
   * nothing about whose panel this is rather than naming the wrong party.
   */
  siteName?: string;
  /**
   * The shop's WORDMARK. Usually the name drawn, so where it exists it replaces
   * the name rather than sitting beside it — the same rule the storefront header
   * and footer follow.
   */
  logo?: string;
  /**
   * The shop's SQUARE icon, for the badge when there is no wordmark. The two are
   * not interchangeable: a 3:1 wordmark in a 48px square is 48x15px.
   */
  favicon?: string;
  className?: string;
}

/**
 * The entrance, in CSS — it runs from the first paint.
 *
 * These were framer-motion `initial={{ opacity: 0 }}` blocks. The server
 * rendered them at opacity 0, and they only became visible once the motion
 * library had downloaded and hydrated: the whole sign-in screen was blank for
 * 3.6s on a throttled phone, with the HTML already there. `motion-safe`: a
 * visitor who asked for reduced motion gets no entrance at all.
 */
const enter =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]";

/**
 * Business-neutral on purpose.
 *
 * These read "Manage cakes, catalog & inventory" — and this CMS runs ten
 * business types, so nine of them were promised a feature list for a trade they
 * are not in. A florist's staff signed in past a line about cakes.
 */
const brandPoints = [
  { icon: Package, title: "Catalogue & stock", text: "Products, prices and inventory" },
  { icon: ShoppingBag, title: "Orders & customers", text: "Every order, customer and enquiry" },
  { icon: LayoutTemplate, title: "Your storefront", text: "Pages, media and homepage content" },
];

/**
 * The brand plane's depth, in CSS alone — no image to download, nothing to
 * hydrate. A flat brown half-screen read as an empty wall: the content sat in
 * its left third and the rest was one colour. A warm glow, a fading dot grain
 * and two rings fill it without competing with the words.
 */
const planeGlow = {
  backgroundImage: [
    "radial-gradient(55% 45% at 90% 8%, color-mix(in oklch, var(--gold-300) 24%, transparent), transparent 70%)",
    "radial-gradient(60% 50% at 0% 100%, color-mix(in oklch, var(--bakery-950) 80%, transparent), transparent 70%)",
  ].join(", "),
};
const planeGrain = {
  backgroundImage: "radial-gradient(var(--cream-50) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
  maskImage: "linear-gradient(to bottom, black, transparent 70%)",
};
const formGlow = {
  backgroundImage:
    "radial-gradient(45% 40% at 50% 45%, color-mix(in oklch, var(--gold-200) 45%, transparent), transparent 75%)",
};

/**
 * The square badge: the shop's icon if it has one, else its initial.
 *
 * Only rendered when there is no wordmark — a wordmark carries the name and gets
 * its own width instead. The favicon is the one image a shop is guaranteed to
 * have made square, which is why it fits here and the wordmark does not: a 3:1
 * mark in a 48px box is 48x15px.
 *
 * Declared at module level, not inside the shell. A component defined during
 * render is a new type on every render, so React remounts its whole subtree
 * instead of updating it — and eslint's `Cannot create components during render`
 * caught exactly that here.
 */
function BrandBadge({
  icon,
  letter,
  name,
  boxClass,
  letterClass,
}: {
  icon: string;
  letter: string;
  name: string;
  boxClass: string;
  letterClass: string;
}) {
  return (
    <div className={cn(boxClass, icon && "overflow-hidden")}>
      {icon ? (
        // An admin-typed URL on any host, so next/image is not usable here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={optimizedImageUrl(icon, { width: 48 })}
          alt=""
          title={name}
          className="size-full object-cover"
        />
      ) : (
        <span className={letterClass}>{letter}</span>
      )}
    </div>
  );
}

/**
 * Staff auth — one brand plane + one form column.
 * Left is the shop's brand; right stays light.
 */
export function AuthLayoutShell({
  children,
  siteName = "",
  logo = "",
  favicon = "",
  className,
}: AuthLayoutShellProps) {
  const name = siteName.trim();
  const letter = name.charAt(0).toUpperCase();
  const wordmark = logo.trim();
  const icon = favicon.trim();


  return (
    <div className={cn("min-h-dvh bg-cream-100 text-foreground", className)}>
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Brand plane */}
        <aside className="relative hidden overflow-hidden bg-bakery-900 lg:flex">
          <div className="pointer-events-none absolute inset-0" style={planeGlow} aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={planeGrain}
            aria-hidden
          />
          {/* Concentric rings on the top-right corner, round the glow. They sat
              off-centre at the bottom right before and cut through the feature
              tiles; the largest (16rem radius) stops short of the heading on a
              1280px screen. */}
          <div className="pointer-events-none absolute top-0 right-0" aria-hidden>
            {[
              "size-[16rem] border-gold-300/30",
              "size-[24rem] border-gold-300/20",
              "size-[32rem] border-gold-300/12",
            ].map((ring) => (
              <span
                key={ring}
                className={cn(
                  "absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full border",
                  ring,
                )}
              />
            ))}
          </div>
          <div className="absolute inset-y-0 right-0 w-px bg-gold-300/30" aria-hidden />

          {/* One centred column, not a block pinned to the left edge: on a wide
              screen the plane is ~1000px and the words sat in its left half. */}
          <div className="relative mx-auto flex w-full max-w-[38rem] flex-col px-12 py-12">
            <div
              className={cn(
                enter,
                "my-auto max-w-lg space-y-10 py-8 motion-safe:slide-in-from-bottom-3.5 motion-safe:duration-450",
              )}
            >
              {/* The wordmark takes the badge's place and the heading's job:
                  it already says the name, and this plane is the widest space
                  on either screen, so it gets a generous height. */}
              {wordmark ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={optimizedImageUrl(wordmark, { height: 64 })}
                  alt={name}
                  className="h-20 w-auto max-w-[320px] object-contain object-left drop-shadow-[0_8px_24px_rgb(0_0_0/0.25)]"
                />
              ) : (
                <BrandBadge
                  icon={icon}
                  letter={letter}
                  name={name}
                  boxClass="flex size-12 items-center justify-center rounded-2xl bg-gold-300"
                  letterClass="font-heading text-xl font-bold text-bakery-900"
                />
              )}

              <div className="space-y-4">
                {/* gold-200: gold-300 on this brown was 4.41:1, under the 4.5
                    small text needs. */}
                <p className="inline-flex items-center gap-2 rounded-full border border-gold-300/25 bg-gold-300/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-gold-200 uppercase">
                  <span className="size-1.5 rounded-full bg-gold-300" aria-hidden />
                  Staff console
                </p>
                {/*
                  The heading says what this screen is FOR, not whose it is.

                  It used to print the shop's name — which the mark above
                  already carries, so under a wordmark the plane read the name
                  twice. Suppressing it left a hole in the hierarchy instead: a
                  logo, then nothing, then small print. A purpose line is the
                  right content for the space, it never duplicates the mark, and
                  it holds whether the shop has a logo or only a letter.
                */}
                <p className="font-heading text-[2.75rem] leading-[1.05] font-bold tracking-tight text-cream-50 xl:text-[3.5rem]">
                  Run your shop from{" "}
                  <span className="text-gold-200">one place</span>
                </p>
                <p className="max-w-sm text-base leading-relaxed text-cream-200/75">
                  {name
                    ? `Sign in to manage ${name} — orders, products and your storefront, together.`
                    : "Sign in to manage your shop — orders, products and your storefront, together."}
                </p>
              </div>

              <ul className="grid gap-3">
                {brandPoints.map(({ icon: Icon, title, text }, i) => (
                  <li
                    key={title}
                    // Each tile follows the one before it in; `backwards` holds
                    // it hidden through its delay instead of flashing first.
                    style={{ animationDelay: `${200 + i * 90}ms` }}
                    className={cn(
                      enter,
                      "flex items-center gap-4 rounded-2xl border border-cream-50/[0.08] bg-cream-50/[0.04] px-4 py-3.5 motion-safe:fill-mode-backwards motion-safe:slide-in-from-bottom-2 motion-safe:duration-500",
                    )}
                  >
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-300/15 text-gold-200 ring-1 ring-gold-300/25"
                      aria-hidden
                    >
                      <Icon className="size-[18px]" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-cream-50">
                        {title}
                      </span>
                      <span className="block text-[13px] text-cream-200/70">{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between gap-4 text-[12px] text-cream-200/55">
              <p>
                {name ? `© ${new Date().getFullYear()} ${name} · ` : ""}Internal staff
                access only
              </p>
              <p className="flex shrink-0 items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-gold-200/80" aria-hidden />
                Secure sign-in
              </p>
            </div>
          </div>
        </aside>

        {/* Form column */}
        <main className="relative isolate flex flex-col justify-center px-5 py-12 sm:px-10 lg:px-14 xl:px-20">
          {/* A warm pool of light behind the card, so the light side is not a
              flat grey sheet next to a rich brown one. */}
          <div className="pointer-events-none absolute inset-0 -z-10" style={formGlow} aria-hidden />
          <div
            className={cn(
              enter,
              "mb-10 flex items-center gap-3 lg:hidden motion-safe:slide-in-from-bottom-2.5 motion-safe:duration-400",
            )}
          >
            {/* Same rule, smaller: the wordmark replaces the badge AND the
                name, and "Staff console" stays either way — it says what the
                screen is, not whose it is. */}
            {wordmark ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={optimizedImageUrl(wordmark, { height: 40 })}
                  alt={name}
                  className="h-10 w-auto max-w-[200px] object-contain object-left"
                />
                <p className="text-xs text-muted-foreground">Staff console</p>
              </>
            ) : (
              <>
                <BrandBadge
                  icon={icon}
                  letter={letter}
                  name={name}
                  boxClass="flex size-11 items-center justify-center rounded-2xl bg-bakery-900"
                  letterClass="font-heading text-lg font-bold text-gold-300"
                />
                <div>
                  <p className="font-heading text-lg font-bold text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">Staff console</p>
                </div>
              </>
            )}
          </div>

          <div
            className={cn(
              enter,
              "mx-auto w-full max-w-[420px] motion-safe:slide-in-from-bottom-3 motion-safe:duration-450",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
