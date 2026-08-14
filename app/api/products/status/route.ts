import { NextResponse } from "next/server";
import { z } from "zod";

import { setProductStatus } from "@/features/products/data/products-service";
import { requireProductAdmin } from "@/features/products/server/guard";
import { validate, readJson } from "@/lib/server/http/validate";
import { AppError } from "@/lib/server/http/errors";
import { writeAuditLog, requestContext } from "@/lib/server/audit/audit-log";

/**
 * Publish or archive many products, changing ONLY their status.
 *
 * Bulk Publish used to send a full product body per selected cake, built from
 * the browser's list. That list is a snapshot: every field another admin had
 * edited since it loaded was written back to its old value, and a stock
 * adjustment or an order placed in between went with it. Ten selected rows meant
 * ten whole-document writes carrying ten copies of the same stale view.
 *
 * One statement, one field.
 */
const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one product"),
  status: z.enum(["draft", "published", "archived"]),
});

export async function POST(request: Request) {
  const auth = await requireProductAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof bodySchema>;
  try {
    body = validate(bodySchema, await readJson(request));
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, errors: error.errors },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const updated = await setProductStatus(body.ids, body.status);
    await writeAuditLog({
      action: `product.status.${body.status}`,
      actorId: auth.sub,
      actorEmail: auth.email,
      target: { type: "product", id: body.ids.join(",") },
      metadata: { ids: body.ids, status: body.status, updated },
      ...requestContext(request),
    });
    return NextResponse.json({ updated });
  } catch {
    return NextResponse.json({ error: "Failed to update products" }, { status: 500 });
  }
}
