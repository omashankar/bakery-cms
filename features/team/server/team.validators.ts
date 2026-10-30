import { z } from "zod";

import { strongPassword } from "@/features/auth/server/auth.validators";

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const roleSlug = z.string().trim().toLowerCase().min(1, "Choose a role").max(64);

export const inviteSchema = z.object({
  name: z.string().trim().min(1, "Enter their name").max(120),
  email,
  role: roleSlug,
  message: z.string().trim().max(500, "Keep the message under 500 characters").optional().default(""),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const memberQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  role: z.string().trim().max(64).optional(),
  status: z.enum(["active", "inactive", "blocked"]).optional(),
});

export const changeRoleSchema = z.object({ role: roleSlug });

export const changeStatusSchema = z.object({
  status: z.enum(["active", "inactive", "blocked"]),
});

const permissionList = z.array(z.string().trim().max(64)).max(200);

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, "Give the role a name").max(60),
  description: z.string().trim().max(300).optional().default(""),
  permissions: permissionList,
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2, "Give the role a name").max(60).optional(),
  description: z.string().trim().max(300).optional(),
  permissions: permissionList.optional(),
});

export const acceptInvitationSchema = z
  .object({
    token: z.string().trim().min(20).max(200),
    name: z.string().trim().min(1, "Enter your name").max(120),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const tokenQuerySchema = z.object({ token: z.string().trim().min(20).max(200) });
