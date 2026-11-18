/**
 * Where an ad can appear. Modelled on how large news sites such as the Washington Post lay out advertising: one wide
 * banner under the header, a banner between sections, a unit inside the story (labelled "Story continues below
 * advertisement"), a sticky unit beside the story on wide screens, and one under the story.
 * Shared by the public renderer and Studio; the ad_slots.placement CHECK (migration 20261119000200) lists the same keys.
 */
export const AD_PLACEMENTS = ["top", "home", "article_inline", "sidebar", "article"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export const AD_PLACEMENT_INFO: Record<AdPlacement, { label: string; where: string; size: string }> = {
  top: { label: "Top banner", where: "Wide banner right under the header on the homepage, story pages and story lists.", size: "970×250 or 728×90" },
  home: { label: "Homepage, between sections", where: "Wide banner on the homepage, below the lead stories.", size: "970×250 or 728×90" },
  article_inline: { label: "Inside the story", where: "Centred inside the story after the third paragraph, under the label “Story continues below advertisement”.", size: "300×250 or 728×90" },
  sidebar: { label: "Side rail (wide screens)", where: "Sticks beside the story while it is read, on screens 1440 px wide and up. Not shown on smaller screens.", size: "300×600 or 300×250" },
  article: { label: "End of the story", where: "Under the story text, above the newsletter box and comments.", size: "970×250 or 728×90" },
};

export const AD_PLACEMENT_LABELS = Object.fromEntries(AD_PLACEMENTS.map((p) => [p, AD_PLACEMENT_INFO[p].label])) as Record<AdPlacement, string>;

/** Size assumed when an image's pixel size is unknown, so the browser can still reserve the right space. */
export const AD_FALLBACK_SIZE: Record<AdPlacement, { width: number; height: number }> = {
  top: { width: 970, height: 250 },
  home: { width: 970, height: 250 },
  article_inline: { width: 300, height: 250 },
  sidebar: { width: 300, height: 600 },
  article: { width: 970, height: 250 },
};
