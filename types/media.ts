import type { BaseEntity } from "./common";

export type MediaType = "image" | "video";

export interface MediaFile extends BaseEntity {
  name: string;
  url: string;
  type: MediaType;
  mimeType: string;
  size: number;
  folderId?: string;
  alt?: string;
  caption?: string;
  tags?: string[];
  width?: number;
  height?: number;
}

export interface MediaFolder extends BaseEntity {
  name: string;
  parentId?: string;
  fileCount?: number;
}

export interface Banner extends BaseEntity {
  title: string;
  image: string;
  link?: string;
  isActive: boolean;
  position: "hero" | "popup" | "sidebar";
  priority: number;
  startDate?: string;
  endDate?: string;
  visibility: "all" | "homepage" | "collections";
}
