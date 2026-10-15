import { notFound } from "next/navigation";

/**
 * Any /store URL nothing else answers.
 *
 * Without this an unmatched /store path fell through to the ROOT not-found,
 * which renders outside every layout — the shop's colours, but no header,
 * search, cart or footer, so a customer on a stale link had two buttons and no
 * shop. Answering here keeps the 404 inside the storefront layout, and
 * `notFound()` still sends the 404 status.
 */
export default function MissingStorePage(): never {
  notFound();
}
