/**
 * One block of product information, always visible.
 *
 * The heading is what a tab label used to be. A section renders only where the
 * shop has filled the field, so an empty one disappears rather than printing
 * somebody else's product back at the customer.
 *
 * No `"use client"`: it is markup and nothing else, so a server component can
 * render it too. That matters — most of what goes inside one of these is text
 * the server already has.
 */
export function DetailSection({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border pt-6">
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
