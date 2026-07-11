export type EntityStatus = "draft" | "published" | "archived";
export type PublishStatus = "active" | "inactive";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeoFields {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  ogImage?: string;
  noIndex?: boolean;
  noFollow?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export type SortDirection = "asc" | "desc";

export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDirection?: SortDirection;
}
