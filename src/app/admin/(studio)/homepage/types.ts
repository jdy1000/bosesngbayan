import type { PickedMedia } from "@/components/studio/media-picker";
import type { BlockSettings, BlockType } from "@/lib/homepage/blocks";

/** Client-safe shapes shared by the homepage builder's server loader and its client forms. */

export interface Option {
  id: string;
  label: string;
}

export interface PickedArticle {
  id: string;
  title: string;
  published: boolean;
}

export interface BuilderOptions {
  polls: Option[];
  categories: Option[];
  locations: Option[];
  /** Media referenced by current sections, for MediaPicker previews. */
  mediaMap: Record<string, PickedMedia>;
  /** Articles referenced by current sections, for manual pickers. */
  articleMap: Record<string, PickedArticle>;
}

export interface BuilderSection {
  id: string;
  type: string;
  position: number;
  isEnabled: boolean;
  title: string | null;
  description: string | null;
  titleEn: string | null;
  descriptionEn: string | null;
  settings: Record<string, unknown>;
  issues: string[];
  updatedAt: string;
}

export type BlockFormProps<T extends BlockType> = {
  value: BlockSettings<T>;
  onChange: (value: BlockSettings<T>) => void;
  options: BuilderOptions;
};
