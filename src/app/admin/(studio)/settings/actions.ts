"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { toActionError } from "@/lib/actions";
import { editableSettingsKey, saveSettingsFromForm, SettingsValidationError } from "@/lib/studio/settings";
import type { FormActionResult } from "@/components/studio/action-form";

export async function saveSettings(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("settings.manage");
    const key = editableSettingsKey.parse(fd.get("key"));
    await saveSettingsFromForm(ctx, key, fd);
    revalidatePath("/", "layout");
    return { ok: true, message: "Na-save ang settings. Makikita na ito sa site." };
  } catch (e) {
    if (e instanceof SettingsValidationError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}
