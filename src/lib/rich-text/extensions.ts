import { Node, mergeAttributes, type Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Blockquote from "@tiptap/extension-blockquote";
import Youtube from "@tiptap/extension-youtube";
import { TableKit } from "@tiptap/extension-table";

/**
 * Figure: image + caption + credit from the media library. Rendered as
 * <figure data-figure><img><figcaption>caption <span class="credit">credit</span></figcaption></figure>.
 */
export const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: "" },
      credit: { default: "" },
      mediaId: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure[data-figure]",
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const img = node.querySelector("img");
          return {
            src: img?.getAttribute("src") ?? null,
            alt: img?.getAttribute("alt") ?? "",
            caption: node.querySelector("[data-caption]")?.textContent ?? "",
            credit: node.querySelector("[data-credit]")?.textContent ?? "",
            mediaId: node.getAttribute("data-media-id"),
          };
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const { src, alt, caption, credit, mediaId } = node.attrs as {
      src: string | null;
      alt: string;
      caption: string;
      credit: string;
      mediaId: string | null;
    };
    const figcaption: unknown[] = ["figcaption", {}];
    if (caption) figcaption.push(["span", { "data-caption": "" }, caption]);
    if (credit) figcaption.push(["span", { "data-credit": "", class: "credit" }, credit]);
    const children: unknown[] = [["img", { src: src ?? "", alt: alt ?? "", loading: "lazy", decoding: "async" }]];
    if (caption || credit) children.push(figcaption);
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-figure": "", "data-media-id": mediaId ?? undefined }),
      ...children,
    ] as unknown as [string, Record<string, unknown>, ...unknown[]];
  },
});

/** Blockquote with an optional "pull" variant used for pull quotes. */
export const QuoteBlock = Blockquote.extend({
  addAttributes() {
    return {
      variant: {
        default: null,
        parseHTML: (el: HTMLElement) => (el.getAttribute("data-variant") === "pull" ? "pull" : null),
        renderHTML: (attrs: { variant: string | null }) => (attrs.variant === "pull" ? { "data-variant": "pull" } : {}),
      },
    };
  },
});

/** Extensions shared by the Studio editor and server-side HTML rendering. */
export function richTextExtensions(): Extensions {
  return [
    StarterKit.configure({
      blockquote: false,
      heading: { levels: [2, 3, 4] },
      link: {
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    QuoteBlock,
    Figure,
    Youtube.configure({ nocookie: true, controls: true, modestBranding: true, width: 640, height: 360 }),
    TableKit.configure({ table: { resizable: false } }),
  ];
}
