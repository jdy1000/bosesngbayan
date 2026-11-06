export const LOCATION_KINDS = ["island_group", "region", "province", "city"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const LOCATION_KIND_LABELS: Record<LocationKind, string> = {
  island_group: "Island group",
  region: "Region",
  province: "Province",
  city: "City / town",
};

/** Required parent kind for each level (island group is the root). */
export const PARENT_KIND: Record<LocationKind, LocationKind | null> = {
  island_group: null,
  region: "island_group",
  province: "region",
  city: "province",
};
