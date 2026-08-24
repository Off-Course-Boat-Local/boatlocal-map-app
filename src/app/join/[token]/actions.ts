"use server";

// The Server Action behind JoinForm's submit — completes exactly the design
// inviteGuide()'s own doc comment describes (src/lib/data/source.ts): look
// up the guide row by invite_token, create the auth user, link it to that
// guide row by email/token, flip status to 'active'.
//
// Also redeems a company's OWNER invite (createCompany's owner_invite_token
// — 20260807000000_company_owner_invite.sql), the exact same shape one
// level up: look up the company row by owner_invite_token, create the auth
// user with role='company' linked to that company, flip owner_status to
// 'active'. joinAction below tries a guide match first, then a company
// match — see page.tsx for why both live behind the same route/token space.
//
// Every step below uses the service-role admin client, deliberately: at the
// point this runs, the caller has no session (they're mid-signup), so there
// is no RLS-respecting client available yet — `profiles` has no self-insert
// policy, and an unredeemed `guides`/`companies` row isn't anon-readable
// either (see page.tsx's own comment). The one exception is the final
// sign-in, which switches to the ordinary anon-key client specifically so
// the response carries real, cookie-backed session state.

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hashUserInviteToken } from "@/lib/admin/userInviteToken";
import { initialFromName, uniqueSlug } from "@/lib/slug";

export interface JoinActionState {
  error?: string;
}

interface PlatformInviteRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: "admin" | "company" | "guide";
  company_id: string | null;
}

async function redeemPlatformUserInvite(
  supabaseAdmin: SupabaseClient,
  invite: PlatformInviteRow,
  firstName: string,
  lastName: string,
  email: string,
  password: string,
): Promise<JoinActionState> {
  if (email !== invite.email.toLowerCase()) {
    return { error: "That email doesn't match this invite." };
  }
  if (!firstName) return { error: "Enter your first name." };

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: invite.email,
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
  let guideId: string | null = null;

  if (invite.role === "guide") {
    if (!invite.company_id) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.id);
      return { error: "This guide invitation is missing its company." };
    }
    const { data: existingGuides, error: slugError } = await supabaseAdmin
      .from("guides")
      .select("slug")
      .eq("company_id", invite.company_id);
    if (slugError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.id);
      return { error: "Could not finish setting up your account. Please try again." };
    }

    const publicGuideName = firstName;
    const slug = uniqueSlug(
      publicGuideName,
      (existingGuides ?? []).map((guide) => guide.slug),
    );
    const { data: guide, error: guideError } = await supabaseAdmin
      .from("guides")
      .insert({
        company_id: invite.company_id,
        name: publicGuideName,
        email: invite.email,
        slug,
        avatar_initial: initialFromName(publicGuideName),
        welcome_message: "",
        status: "active",
      })
      .select("id")
      .single();
    if (guideError || !guide) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.id);
      return { error: "Could not finish setting up your guide account. Please try again." };
    }
    guideId = guide.id;
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ");
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: newUser.id,
    role: invite.role,
    company_id: invite.role === "admin" ? null : invite.company_id,
    guide_id: guideId,
    email: invite.email,
    display_name: displayName,
    // Staff choose their password on this very form, so the Admin login flow
    // must not force them through a second password-setup screen.
    password_set: invite.role === "admin",
  });
  if (profileError) {
    if (guideId) await supabaseAdmin.from("guides").delete().eq("id", guideId);
    await supabaseAdmin.auth.admin.deleteUser(newUser.id);
    return { error: "Could not finish setting up your account. Please try again." };
  }

  const { data: accepted, error: acceptError } = await supabaseAdmin
    .from("user_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (acceptError || !accepted) {
    if (guideId) await supabaseAdmin.from("guides").delete().eq("id", guideId);
    await supabaseAdmin.auth.admin.deleteUser(newUser.id);
    return { error: "This invite has already been used or is no longer valid." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });
  if (signInError) redirect(invite.role === "admin" ? "/admin/login" : "/studio/login");
  redirect(invite.role === "admin" ? "/admin" : "/studio");
}

async function redeemGuideInvite(
  supabaseAdmin: SupabaseClient,
  guide: { id: string; email: string; company_id: string },
  name: string,
  email: string,
  password: string,
): Promise<JoinActionState> {
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

async function redeemCompanyOwnerInvite(
  supabaseAdmin: SupabaseClient,
  company: { id: string; owner_email: string },
  name: string,
  email: string,
  password: string,
): Promise<JoinActionState> {
  // Same tamper guard as the guide path above — the token already
  // identifies the row, this only catches a submission claiming a
  // different address than the one the invite was actually issued to.
  if (email !== company.owner_email.toLowerCase()) {
    return { error: "That email doesn't match this invite." };
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: company.owner_email,
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

  // role='company' requires company_id set and guide_id null
  // (profile_role_shape, supabase/migrations/20260805063610_init_schema.sql)
  // — guide_id is simply omitted, defaulting to null.
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: newUser.id,
    role: "company",
    company_id: company.id,
    email: company.owner_email,
    display_name: name,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(newUser.id);
    return { error: "Could not finish setting up your account. Please try again." };
  }

  // Same atomic-flip pattern as the guide path: conditioned on owner_status
  // still being 'invited' so a truly concurrent double-submit can only
  // activate once.
  const { data: activated, error: companyUpdateError } = await supabaseAdmin
    .from("companies")
    .update({
      owner_status: "active",
      owner_invite_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", company.id)
    .eq("owner_status", "invited")
    .select("id")
    .maybeSingle();

  if (companyUpdateError || !activated) {
    await supabaseAdmin.auth.admin.deleteUser(newUser.id);
    return { error: "This invite has already been used or is no longer valid." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: company.owner_email,
    password,
  });

  if (signInError) {
    redirect("/studio/login");
  }

  redirect("/studio");
}

export async function joinAction(
  token: string,
  _prevState: JoinActionState,
  formData: FormData,
): Promise<JoinActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "Choose a password with at least 8 characters." };
  }

  const supabaseAdmin = createAdminClient();

  const { data: platformInvite } = await supabaseAdmin
    .from("user_invites")
    .select("id, email, first_name, last_name, role, company_id, accepted_at, revoked_at")
    .eq("token_hash", hashUserInviteToken(token))
    .maybeSingle();

  if (platformInvite) {
    if (platformInvite.accepted_at || platformInvite.revoked_at) {
      return { error: "This invite has already been used or is no longer valid." };
    }
    return redeemPlatformUserInvite(
      supabaseAdmin,
      platformInvite as PlatformInviteRow,
      firstName,
      lastName,
      email,
      password,
    );
  }

  if (!name) return { error: "Enter your name." };

  // Re-fetch + re-check status here, not just at page-render time: closes
  // the race where the same link is submitted twice, or the invite is
  // revoked between page load and submit.
  const { data: guide, error: guideError } = await supabaseAdmin
    .from("guides")
    .select("id, email, status, company_id")
    .eq("invite_token", token)
    .maybeSingle();

  if (guide && !guideError) {
    if (guide.status !== "invited") {
      return { error: "This invite has already been used or is no longer valid." };
    }
    return redeemGuideInvite(supabaseAdmin, guide, name, email, password);
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from("companies")
    .select("id, owner_email, owner_status")
    .eq("owner_invite_token", token)
    .maybeSingle();

  if (companyError || !company || !company.owner_email) {
    return { error: "This invite link is invalid." };
  }
  if (company.owner_status !== "invited") {
    return { error: "This invite has already been used or is no longer valid." };
  }

  return redeemCompanyOwnerInvite(
    supabaseAdmin,
    { id: company.id, owner_email: company.owner_email },
    name,
    email,
    password,
  );
}
