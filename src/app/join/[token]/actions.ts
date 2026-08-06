"use server";

// The Server Action behind JoinForm's submit — completes exactly the design
// inviteGuide()'s own doc comment describes (src/lib/data/source.ts): look
// up the guide row by invite_token, create the auth user, link it to that
// guide row by email/token, flip status to 'active'.
//
// Every step below uses the service-role admin client, deliberately: at the
// point this runs, the caller has no session (they're mid-signup), so there
// is no RLS-respecting client available yet — `profiles` has no self-insert
// policy, and an unredeemed `guides` row (status='invited') isn't
// anon-readable either (see page.tsx's own comment). The one exception is
// the final sign-in, which switches to the ordinary anon-key client
// specifically so the response carries real, cookie-backed session state.

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface JoinActionState {
  error?: string;
}

export async function joinAction(
  token: string,
  _prevState: JoinActionState,
  formData: FormData,
): Promise<JoinActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Enter your name." };
  if (password.length < 8) {
    return { error: "Choose a password with at least 8 characters." };
  }

  const supabaseAdmin = createAdminClient();

  // Re-fetch + re-check status==='invited' here, not just at page-render
  // time: closes the race where the same link is submitted twice, or a
  // company revokes/deactivates the invite between page load and submit.
  const { data: guide, error: guideError } = await supabaseAdmin
    .from("guides")
    .select("id, name, email, status, company_id")
    .eq("invite_token", token)
    .maybeSingle();

  if (guideError || !guide) {
    return { error: "This invite link is invalid." };
  }
  if (guide.status !== "invited") {
    return { error: "This invite has already been used or is no longer valid." };
  }

  // Never trust the form's locked email field alone — the token already
  // identifies the row; this only guards against a tampered submission
  // claiming a different address than the one this invite was sent to.
  if (email !== guide.email.toLowerCase()) {
    return { error: "That email doesn't match this invite." };
  }

  // email_confirm: true is correct here — the invite link itself (sent by
  // the company, containing an unguessable per-guide token) already served
  // as the verification step. A second confirmation email would add
  // friction the PRD's 3-field form doesn't ask for.
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: guide.email,
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    if (createError && /already/i.test(createError.message)) {
      return { error: "An account already exists for this email — sign in instead." };
    }
    return { error: "Could not create your account. Please try again." };
  }

  const newUser = created.user;

  // Satisfies both profile_role_shape (guide role needs both company_id and
  // guide_id) and the profile_guide_company_matches trigger (guide_id's own
  // company_id must match — guaranteed here since company_id was read
  // directly off the guide row this invite_token identifies).
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: newUser.id,
    role: "guide",
    company_id: guide.company_id,
    guide_id: guide.id,
    email: guide.email,
    display_name: name,
  });

  if (profileError) {
    // Don't leave an orphaned login with no profile behind it if this step
    // fails — the invite is still redeemable afterwards since the guide row
    // is untouched below.
    await supabaseAdmin.auth.admin.deleteUser(newUser.id);
    return { error: "Could not finish setting up your account. Please try again." };
  }

  // Conditioned on status still being 'invited' (not just id): closes the
  // remaining window in a truly concurrent double-submit (both requests
  // could pass the re-check above before either writes) by making the
  // activation itself atomic — only one concurrent request can match this
  // row and flip it, the other gets zero rows back below.
  const { data: activated, error: guideUpdateError } = await supabaseAdmin
    .from("guides")
    .update({
      name,
      status: "active",
      invite_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", guide.id)
    .eq("status", "invited")
    .select("id")
    .maybeSingle();

  if (guideUpdateError || !activated) {
    // Lost the race to another concurrent submission of the same link, or
    // an unexpected write failure either way, this auth user + profile
    // pair is now orphaned relative to a guide row that's already active
    // under someone else's submission — clean it up rather than leave a
    // dangling login.
    await supabaseAdmin.auth.admin.deleteUser(newUser.id);
    return { error: "This invite has already been used or is no longer valid." };
  }

  // Sign the new user in immediately with the password they just supplied —
  // no second magic-link round trip needed since this same request already
  // holds valid credentials. Uses the ordinary anon-key client (not the
  // admin client) so this goes through @supabase/ssr's cookie adapter and
  // the response actually carries a session.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: guide.email,
    password,
  });

  if (signInError) {
    redirect("/studio/login");
  }

  redirect("/studio");
}
