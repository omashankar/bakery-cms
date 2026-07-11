import type { BaseEntity } from "./common";

export interface User extends BaseEntity {
  name: string;
  email: string;
  avatar?: string;
  role: "admin";
}

export interface AuthSession {
  user: User;
  expiresAt: string;
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface OtpFormData {
  otp: string;
}

export interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}
