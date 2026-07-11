import type { Testimonial, TestimonialFormData } from "@/types/content";
import type { LandingTestimonial } from "@/constants/landing-data";
import { testimonials as seedTestimonials } from "@/constants/landing-data";
import { fixBrokenImageUrl } from "@/constants/demo-images";

const STORAGE_KEY = "bakery-cms-testimonials";
const STORAGE_VERSION_KEY = "bakery-cms-testimonials-version";
const TESTIMONIALS_STORAGE_VERSION = 2;

function nowIso(): string {
  return new Date().toISOString();
}

function seedFromLanding(): Testimonial[] {
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

function persist(items: Testimonial[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
    persist(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(TESTIMONIALS_STORAGE_VERSION));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as Testimonial[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = seedFromLanding();
      persist(seeded);
      localStorage.setItem(STORAGE_VERSION_KEY, String(TESTIMONIALS_STORAGE_VERSION));
      return seeded;
    }

    const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 1);
    const { items: normalized, changed } = normalizeTestimonials(parsed);

    if (changed || storedVersion < TESTIMONIALS_STORAGE_VERSION) {
      persist(normalized);
      localStorage.setItem(STORAGE_VERSION_KEY, String(TESTIMONIALS_STORAGE_VERSION));
    }

    return normalized;
  } catch {
    const seeded = seedFromLanding();
    persist(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(TESTIMONIALS_STORAGE_VERSION));
    return seeded;
  }
}

export function getPublishedTestimonials(): Testimonial[] {
  return loadTestimonials()
    .filter((item) => item.status === "published")
    .sort((a, b) => a.sortOrder - b.sortOrder);
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

export function createTestimonial(data: TestimonialFormData): Testimonial {
  const items = loadTestimonials();
  const timestamp = nowIso();
  const created: Testimonial = {
    ...data,
    id: `testimonial-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  persist([...items, created]);
  return created;
}

export function updateTestimonial(
  id: string,
  patch: Partial<TestimonialFormData>
): Testimonial | null {
  const items = loadTestimonials();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated: Testimonial = {
    ...items[index],
    ...patch,
    id,
    updatedAt: nowIso(),
  };
  items[index] = updated;
  persist(items);
  return updated;
}

export function deleteTestimonials(ids: string[]): number {
  const items = loadTestimonials();
  const next = items.filter((item) => !ids.includes(item.id));
  const count = items.length - next.length;
  persist(next);
  return count;
}

export function bulkUpdateTestimonialStatus(
  ids: string[],
  status: Testimonial["status"]
): number {
  const items = loadTestimonials();
  let count = 0;
  const next = items.map((item) => {
    if (!ids.includes(item.id)) return item;
    count += 1;
    return { ...item, status, updatedAt: nowIso() };
  });
  persist(next);
  return count;
}
