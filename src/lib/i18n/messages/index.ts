import type { Locale } from "@/lib/i18n/config";
import * as article from "./article";
import * as blocks from "./blocks";
import * as common from "./common";
import * as community from "./community";
import * as newsletter from "./newsletter";
import * as poll from "./poll";
import * as tips from "./tips";

/** Public-site interface strings, one namespace per area. Placeholders use {name}; see fmt(). */
const fil = {
  common: common.fil,
  article: article.fil,
  poll: poll.fil,
  community: community.fil,
  blocks: blocks.fil,
  newsletter: newsletter.fil,
  tips: tips.fil,
};

export type Messages = typeof fil;

const en: Messages = {
  common: common.en,
  article: article.en,
  poll: poll.en,
  community: community.en,
  blocks: blocks.en,
  newsletter: newsletter.en,
  tips: tips.en,
};

export const MESSAGES: Record<Locale, Messages> = { fil, en };
