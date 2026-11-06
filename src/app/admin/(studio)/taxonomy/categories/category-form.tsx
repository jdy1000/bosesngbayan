import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { MediaPicker, type PickedMedia } from "@/components/studio/media-picker";
import { Field } from "@/components/studio/ui";
import { saveCategory } from "../actions";

export interface CategoryValues {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_featured: boolean;
  is_active: boolean;
}

export function CategoryForm({ values, image }: { values?: CategoryValues; image?: PickedMedia | null }) {
  return (
    <ActionForm action={saveCategory} className="space-y-5">
      {values && <input type="hidden" name="id" value={values.id} />}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Pangalan" htmlFor="name">
          <input id="name" name="name" required maxLength={80} defaultValue={values?.name} className="field" />
        </Field>
        <Field label="Slug" htmlFor="slug" hint="Iwanang blangko para gawin mula sa pangalan. Ang pagbabago nito ay nagbabago ng URL.">
          <input id="slug" name="slug" maxLength={140} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={values?.slug} className="field" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Paglalarawan" htmlFor="description" hint="Lumalabas sa archive page. Hanggang 600 character.">
            <textarea id="description" name="description" rows={3} maxLength={600} defaultValue={values?.description ?? ""} className="field py-2" />
          </Field>
        </div>
        <div className="md:col-span-2">
          <MediaPicker name="image_id" label="Larawan ng kategorya" defaultValue={image ?? null} />
        </div>
        <Field label="SEO title" htmlFor="seo_title" hint="Hanggang 120 character. Blangko = pangalan ng kategorya.">
          <input id="seo_title" name="seo_title" maxLength={120} defaultValue={values?.seo_title ?? ""} className="field" />
        </Field>
        <Field label="SEO description" htmlFor="seo_description" hint="Hanggang 320 character.">
          <textarea id="seo_description" name="seo_description" rows={2} maxLength={320} defaultValue={values?.seo_description ?? ""} className="field py-2" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="inline-flex min-h-11 items-center gap-2">
          <input type="checkbox" name="is_active" defaultChecked={values?.is_active ?? true} className="size-4" />
          Aktibo (nakikita sa publiko)
        </label>
        <label className="inline-flex min-h-11 items-center gap-2">
          <input type="checkbox" name="is_featured" defaultChecked={values?.is_featured ?? false} className="size-4" />
          Featured
        </label>
      </div>
      <SubmitButton>{values ? "I-save ang kategorya" : "Gumawa ng kategorya"}</SubmitButton>
    </ActionForm>
  );
}
