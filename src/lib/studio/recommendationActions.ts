"use server";

// Server Actions for the Studio "Add / edit / delete place" flow (PRD §7.4
// company base list, §6.3 guide personal additions).
//
// A file with a top-level "use server" directive may only export async
// functions (see node_modules/next/dist/docs/01-app/03-api-reference/
// 01-directives/use-server.md) — that is why field parsing/validation and
// the category-option list live in the plain (directive-free)
// ./recommendationForm.ts instead of here, and why that module is imported
// rather than merged into this one.
//
// Permission enforcement itself is NOT duplicated here: saveRecommendation/
// deleteRecommendation in src/lib/data/source.ts already re-check the actor
// against the same rules as the RLS policies (a company may only write its
// own base-list rows, a guide only their own rows) and throw
// StudioPermissionError on a denied write. This module's job is just to
// resolve the dev-auth session into a StudioActor and translate that error
// into the shape useActionState/the client expect.

import { revalidatePath } from "next/cache";

import { deleteRecommendation, saveRecommendation } from "@/lib/data/source";
import { StudioPermissionError } from "@/lib/data/types";
import { actorFromSession, requireDevSession } from "./devAuth";
import { parseRecommendationForm } from "./recommendationForm";

export interface RecommendationFormState {
  error?: string;
  success?: boolean;
}

/** Passed to useActionState in RecommendationForm.tsx. */
export async function saveRecommendationAction(
  _prevState: RecommendationFormState,
  formData: FormData,
): Promise<RecommendationFormState> {
  const session = await requireDevSession();
  const actor = actorFromSession(session);

  const parsed = parseRecommendationForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await saveRecommendation(actor, parsed.value);
  } catch (err) {
    if (err instanceof StudioPermissionError) return { error: err.message };
    throw err;
  }

  revalidatePath("/studio/recommendations");
  return { success: true };
}

/**
 * Called directly from RecommendationsManager.tsx's onClick (Server
 * Functions can be invoked like any other async function from a Client
 * Component — see the use-server directive docs' "Using Server Functions in
 * a Client Component" section), not wired to a <form>.
 */
export async function deleteRecommendationAction(id: string): Promise<{ error?: string }> {
  const session = await requireDevSession();
  const actor = actorFromSession(session);

  try {
    await deleteRecommendation(actor, id);
  } catch (err) {
    if (err instanceof StudioPermissionError) return { error: err.message };
    throw err;
  }

  revalidatePath("/studio/recommendations");
  return {};
}
