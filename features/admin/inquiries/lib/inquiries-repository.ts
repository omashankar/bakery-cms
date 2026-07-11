import type { Inquiry, InquiryStatus, InquiryType } from "@/types/inquiry";

const STORAGE_KEY = "bakery-cms-inquiries";

export const INQUIRIES_UPDATED_EVENT = "bakery-inquiries-updated";

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgo(days: number, hours = 0): string {
  return new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();
}

function seedInquiries(): Inquiry[] {
  const timestamp = nowIso();

  const items = [
    {
      id: "inq-1",
      type: "wedding",
      name: "Priya Sharma",
      email: "priya.sharma@email.com",
      phone: "+91 98765 43210",
      subject: "3-tier wedding cake for December",
      message:
        "We are planning a December wedding for 250 guests and need a 3-tier fondant cake with floral accents. Can you share pricing and tasting options?",
      status: "new",
      eventDate: "2026-12-18",
      guestCount: 250,
      createdAt: daysAgo(0, 2),
      updatedAt: daysAgo(0, 2),
    },
    {
      id: "inq-2",
      type: "contact",
      name: "Rahul Mehta",
      email: "rahul.mehta@email.com",
      phone: "+91 91234 56789",
      subject: "Custom birthday cake",
      message:
        "Looking for a custom chocolate truffle cake for my daughter's 10th birthday. Need delivery to Bandra on Saturday.",
      status: "in_progress",
      notes: "Follow up with pricing for 2kg cake.",
      createdAt: daysAgo(0, 5),
      updatedAt: daysAgo(0, 1),
    },
    {
      id: "inq-3",
      type: "contact",
      name: "Ananya Patel",
      email: "ananya.patel@email.com",
      subject: "Corporate order inquiry",
      message:
        "We need 40 assorted cupcakes for an office event next Friday. Please share vegetarian options.",
      status: "replied",
      createdAt: daysAgo(1),
      updatedAt: daysAgo(0, 8),
    },
    {
      id: "inq-4",
      type: "wedding",
      name: "Kunal Verma",
      email: "kunal.verma@email.com",
      phone: "+91 99887 76655",
      subject: "Wedding cake tasting",
      message:
        "Interested in scheduling a tasting session for our February wedding. Prefer buttercream finish.",
      status: "new",
      eventDate: "2027-02-14",
      guestCount: 180,
      createdAt: daysAgo(1, 4),
      updatedAt: daysAgo(1, 4),
    },
    {
      id: "inq-5",
      type: "contact",
      name: "Sneha Reddy",
      email: "sneha.reddy@email.com",
      subject: "Eggless red velvet cake",
      message: "Do you make eggless red velvet cakes? Need one for Sunday pickup.",
      status: "closed",
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      id: "inq-6",
      type: "wedding",
      name: "Meera & Arjun",
      email: "meera.arjun@email.com",
      phone: "+91 90000 11122",
      subject: "Destination wedding cake",
      message:
        "Planning a beach wedding in Goa. Need guidance on cake transport and humidity-safe designs.",
      status: "in_progress",
      eventDate: "2026-11-05",
      guestCount: 120,
      notes: "Share portfolio of outdoor wedding cakes.",
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
    {
      id: "inq-7",
      type: "contact",
      name: "Vikram Joshi",
      email: "vikram.joshi@email.com",
      subject: "Anniversary cake order",
      message: "Need a heart-shaped cake with gold accents for our 25th anniversary.",
      status: "new",
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    },
    {
      id: "inq-8",
      type: "wedding",
      name: "Divya Nair",
      email: "divya.nair@email.com",
      subject: "Minimalist wedding cake",
      message: "Looking for a minimalist 2-tier cake with fresh flowers for an intimate ceremony.",
      status: "replied",
      eventDate: "2026-09-20",
      guestCount: 80,
      createdAt: daysAgo(6),
      updatedAt: daysAgo(5),
    },
    {
      id: "inq-9",
      type: "contact",
      name: "Aisha Khan",
      email: "aisha.khan@email.com",
      phone: "+91 95555 44433",
      subject: "Bulk order for school event",
      message: "Need 60 mini pastries for a school annual day. Budget-friendly options welcome.",
      status: "closed",
      createdAt: daysAgo(10),
      updatedAt: daysAgo(8),
    },
    {
      id: "inq-10",
      type: "wedding",
      name: "Rohan & Neha",
      email: "rohan.neha@email.com",
      subject: "Engagement cake",
      message: "We want a small engagement cake with custom monogram toppers.",
      status: "new",
      eventDate: "2026-08-12",
      guestCount: 60,
      createdAt: daysAgo(12),
      updatedAt: daysAgo(12),
    },
    {
      id: "inq-11",
      type: "contact",
      name: "Tanvi Desai",
      email: "tanvi.desai@email.com",
      subject: "Gluten-free options",
      message: "Do you offer gluten-free celebration cakes? Need one for next month.",
      status: "in_progress",
      createdAt: daysAgo(15),
      updatedAt: daysAgo(14),
    },
    {
      id: "inq-12",
      type: "wedding",
      name: "Ishaan & Pooja",
      email: "ishaan.pooja@email.com",
      phone: "+91 97777 88899",
      subject: "Traditional wedding cake design",
      message: "Interested in a traditional tiered cake with marigold-inspired accents.",
      status: "closed",
      eventDate: "2026-06-28",
      guestCount: 300,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(18),
    },
  ].map((inquiry) => ({
    ...inquiry,
    updatedAt: inquiry.updatedAt ?? timestamp,
  })) as Inquiry[];

  return items;
}

function persistInquiries(inquiries: Inquiry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inquiries));
  window.dispatchEvent(new Event(INQUIRIES_UPDATED_EVENT));
}

export function loadInquiries(): Inquiry[] {
  if (typeof window === "undefined") return seedInquiries();

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedInquiries();
    persistInquiries(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as Inquiry[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedInquiries();
  } catch {
    return seedInquiries();
  }
}

export function getInquiryById(id: string): Inquiry | null {
  return loadInquiries().find((inquiry) => inquiry.id === id) ?? null;
}

export function addInquiry(
  input: Omit<Inquiry, "id" | "createdAt" | "updatedAt" | "status"> & {
    status?: InquiryStatus;
  }
): Inquiry {
  const inquiries = loadInquiries();
  const timestamp = nowIso();
  const created: Inquiry = {
    ...input,
    status: input.status ?? "new",
    id: `inq-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  persistInquiries([created, ...inquiries]);
  return created;
}

export function updateInquiry(
  id: string,
  patch: Partial<Inquiry>
): Inquiry | null {
  const inquiries = loadInquiries();
  const index = inquiries.findIndex((inquiry) => inquiry.id === id);
  if (index === -1) return null;

  const updated: Inquiry = {
    ...inquiries[index],
    ...patch,
    id,
    updatedAt: nowIso(),
  };
  inquiries[index] = updated;
  persistInquiries(inquiries);
  return updated;
}

export function deleteInquiries(ids: string[]): number {
  const inquiries = loadInquiries();
  const next = inquiries.filter((inquiry) => !ids.includes(inquiry.id));
  const count = inquiries.length - next.length;
  persistInquiries(next);
  return count;
}

export function countNewInquiries(): number {
  return loadInquiries().filter((inquiry) => inquiry.status === "new").length;
}

export function getRecentInquiries(limit = 5): Inquiry[] {
  return loadInquiries()
    .filter((inquiry) => inquiry.type !== "newsletter")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function createInquiryFromForm(data: {
  type: InquiryType;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  eventDate?: string;
  guestCount?: number;
}): Inquiry {
  return addInquiry({
    type: data.type,
    name: data.name,
    email: data.email,
    phone: data.phone,
    subject: data.subject,
    message: data.message,
    eventDate: data.eventDate,
    guestCount: data.guestCount,
  });
}
