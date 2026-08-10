import type { Testimonial, TestimonialFormData } from "@/types/content";
import type { WriteResult } from "@/lib/write-result";
import type { LandingTestimonial } from "@/constants/landing-data";
import { testimonials as seedTestimonials } from "@/constants/landing-data";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import { replaceTestimonialsRequest } from "./content-api";

const STORAGE_KEY = "bakery-cms-testimonials";
const STORAGE_VERSION_KEY = "bakery-cms-testimonials-version";
const TESTIMONIALS_STORAGE_VERSION = 2;

function nowIso(): string {
  return new Date().toISOString();
}

export function seedFromLanding(): Testimonial[] {
  return seedTestimonials.map((item, index) => ({
    id: item.id,
    name: item.name,
    role: item.role,
    content: item.content,
    avatar: item.avatar,
    rating: item.rating,
    status: "published" as const,
    isFeatured: index === 0,
    sortOrder: index + 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));
}

/** Local-only write. Used by the seed/migration paths (no server dual-write). */
function lowPersist(items: Testimonial[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Mutation write: local first, then the server, reporting what the server did. */
async function persist(items: Testimonial[]): Promise<boolean> {
  lowPersist(items);
  return replaceTestimonialsRequest(items);
}

/** Hydration: write the server's testimonials into the local cache (no re-push). */
export function persistServerTestimonials(items: Testimonial[]): void {
  lowPersist(items);
}

function normalizeTestimonials(items: Testimonial[]): {
  items: Testimonial[];
  changed: boolean;
} {
  let changed = false;
  const next = items.map((item) => {
    const avatar = fixBrokenImageUrl(item.avatar);
    if (avatar === item.avatar) return item;
    changed = true;
    return { ...item, avatar };
  });
  return { items: next, changed };
}

export function loadTestimonials(): Testimonial[] {
  if (typeof window === "undefined") return seedFromLanding();

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedFromLanding();
    lowPersist(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(TESTIMONIALS_STORAGE_VERSION));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as Testimonial[];
    // An empty list is an ANSWER, not a missing one.
    //
    // Re-seeding on an empty array was the bug the local-only write was meant to
    // contain, and containing it was not enough: the admin page reads this list
    // into its state and every mutation is a replace-all that sends the whole
    // list, so the demo testimonials came back on screen and the admin's next
    // save pushed them to the server. Only a missing or non-array value seeds.
    if (!Array.isArray(parsed)) {
      const seeded = seedFromLanding();
      lowPersist(seeded);
      localStorage.setItem(STORAGE_VERSION_KEY, String(TESTIMONIALS_STORAGE_VERSION));
      return seeded;
    }

    const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 1);
    const { items: normalized, changed } = normalizeTestimonials(parsed);

    if (changed || storedVersion < TESTIMONIALS_STORAGE_VERSION) {
      lowPersist(normalized);
      localStorage.setItem(STORAGE_VERSION_KEY, String(TESTIMONIALS_STORAGE_VERSION));
    }

    return normalized;
  } catch {
    const seeded = seedFromLanding();
    lowPersist(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(TESTIMONIALS_STORAGE_VERSION));
    return seeded;
  }
}

/** Featured first, then the admin's order — the same rule as the server selector. */
export function getPublishedTestimonials(): Testimonial[] {
  return loadTestimonials()
    .filter((item) => item.status === "published")
    .sort(
      (a, b) =>
        Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) ||
        a.sortOrder - b.sortOrder,
    );
}

export function toLandingTestimonial(item: Testimonial): LandingTestimonial {
  return {
    id: item.id,
    name: item.name,
    role: item.role,
    content: item.content,
    avatar: item.avatar,
    rating: item.rating,
  };
}

export function getTestimonialById(id: string): Testimonial | null {
  return loadTestimonials().find((item) => item.id === id) ?? null;
}

export function createEmptyTestimonialForm(): TestimonialFormData {
  return {
    name: "",
    role: "",
    content: "",
    avatar: "",
    rating: 5,
    status: "draft",
    isFeatured: false,
    sortOrder: loadTestimonials().length + 1,
  };
}

export async function createTestimonial(
  data: TestimonialFormData
): Promise<WriteResult<Testimonial>> {
  const items = loadTestimonials();
  const timestamp = nowIso();
  const created: Testimonial = {
    ...data,
    id: `testimonial-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { value: created, persisted: await persist([...items, created]) };
}

export async function updateTestimonial(
  id: string,
  patch: Partial<TestimonialFormData>
): Promise<WriteResult<Testimonial | null>> {
  const items = loadTestimonials();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return { value: null, persisted: false };

  const updated: Testimonial = {
    ...items[index],
    ...patch,
    id,
    updatedAt: nowIso(),
  };
  items[index] = updated;
  return { value: updated, persisted: await persist(items) };
}

export async function deleteTestimonials(ids: string[]): Promise<WriteResult<number>> {
  const items = loadTestimonials();
  const next = items.filter((item) => !ids.includes(item.id));
  const count = items.length - next.length;
  return { value: count, persisted: await persist(next) };
}

export async function bulkUpdateTestimonialStatus(
  ids: string[],
  status: Testimonial["status"]
): Promise<WriteResult<number>> {
  const items = loadTestimonials();
  let count = 0;
  const next = items.map((item) => {
    if (!ids.includes(item.id)) return item;
    count += 1;
    return { ...item, status, updatedAt: nowIso() };
  });
  return { value: count, persisted: await persist(next) };
}
