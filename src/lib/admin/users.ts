import "server-only";

import type { User } from "@supabase/supabase-js";

import { emailBaseUrl, sendEmail } from "@/lib/email/client";
import { passwordResetEmail, platformUserInviteEmail } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserInviteToken, hashUserInviteToken } from "./userInviteToken";

export type PlatformUserRole = "admin" | "company" | "guide";
export type PlatformUserStatus = "active" | "invited" | "deactivated";

export const USER_ROLE_LABEL = {
  admin: "Staff",
  company: "Company admin",
  guide: "Guide",
} as const satisfies Record<PlatformUserRole, string>;

export interface PlatformUserListItem {
  id: string;
  name: string | null;
  email: string;
  role: PlatformUserRole;
  companyName: string | null;
  status: PlatformUserStatus;
  createdAt: string;
  lastActiveAt: string | null;
}

interface NewPlatformInvite {
  email: string;
  firstName: string;
  lastName: string;
  role: PlatformUserRole;
  companyId: string | null;
  invitedBy: string;
}

export type CreatePlatformInviteResult =
  | { status: "exists" }
  | { status: "error"; error: string }
  | {
      status: "created";
      emailSent: boolean;
      inviteUrl: string;
      emailError?: string;
    };

const AUTH_PAGE_SIZE = 1000;

async function listAllAuthUsers(): Promise<User[]> {
  const admin = createAdminClient();
  const users: User[] = [];

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < AUTH_PAGE_SIZE) return users;
  }
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function fullName(firstName: string, lastName: string): string | null {
  const value = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  return value || null;
}

/**
 * Checks every account source, not only profiles. The Auth Admin scan catches
 * an interrupted legacy signup that created auth.users but failed before its
 * profile insert; the three table checks cover pending generic and legacy
 * invitations that do not have an Auth user yet.
 */
export async function platformEmailExists(rawEmail: string): Promise<boolean> {
  const email = normalizedEmail(rawEmail);
  const admin = createAdminClient();

  const [authUsers, profiles, invites, guides, companies] = await Promise.all([
    listAllAuthUsers(),
    admin.from("profiles").select("email"),
    admin
      .from("user_invites")
      .select("email")
      .is("accepted_at", null)
      .is("revoked_at", null),
    admin.from("guides").select("email").eq("status", "invited"),
    admin.from("companies").select("owner_email").eq("owner_status", "invited"),
  ]);

  // During the code/deployment window the new table may not exist yet. That
  // should not break read-only email checks for the already-live account
  // sources; the final INSERT still fails closed until the migration lands.
  const pendingInviteRows = invites.error ? [] : (invites.data ?? []);
  if (profiles.error) throw profiles.error;
  if (guides.error) throw guides.error;
  if (companies.error) throw companies.error;

  return [
    ...authUsers.map((user) => user.email ?? ""),
    ...(profiles.data ?? []).map((row) => row.email),
    ...pendingInviteRows.map((row) => row.email),
    ...(guides.data ?? []).map((row) => row.email),
    ...(companies.data ?? []).map((row) => row.owner_email ?? ""),
  ].some((candidate) => normalizedEmail(candidate) === email);
}

export async function createPlatformInvite(
  input: NewPlatformInvite,
): Promise<CreatePlatformInviteResult> {
  const email = normalizedEmail(input.email);
  if (await platformEmailExists(email)) return { status: "exists" };

  const admin = createAdminClient();
  let companyName: string | undefined;

  if (input.role !== "admin") {
    if (!input.companyId) return { status: "error", error: "Choose a company for this role." };
    const { data: company, error } = await admin
      .from("companies")
      .select("id, name")
      .eq("id", input.companyId)
      .maybeSingle();
    if (error || !company) return { status: "error", error: "That company no longer exists." };
    companyName = company.name;
  }

  const rawToken = createUserInviteToken();
  const tokenHash = hashUserInviteToken(rawToken);
  const { error: insertError } = await admin.from("user_invites").insert({
    email,
    first_name: input.firstName || null,
    last_name: input.lastName || null,
    role: input.role,
    company_id: input.role === "admin" ? null : input.companyId,
    token_hash: tokenHash,
    invited_by: input.invitedBy,
  });

  if (insertError) {
    if (insertError.code === "23505") return { status: "exists" };
    return {
      status: "error",
      error: "Could not create the invitation. Make sure the latest database migration is applied.",
    };
  }

  let baseUrl: string;
  try {
    baseUrl = emailBaseUrl();
  } catch (error) {
    return {
      status: "created",
      emailSent: false,
      inviteUrl: `/join/${rawToken}`,
      emailError: error instanceof Error ? error.message : "Email links are not configured.",
    };
  }

  const inviteUrl = `${baseUrl}/join/${rawToken}`;
  const rendered = platformUserInviteEmail({
    firstName: input.firstName || undefined,
    roleLabel: USER_ROLE_LABEL[input.role],
    companyName,
    inviteUrl,
    baseUrl,
  });
  const sendResult = await sendEmail({ to: email, ...rendered });

  return sendResult.ok
    ? { status: "created", emailSent: true, inviteUrl }
    : {
        status: "created",
        emailSent: false,
        inviteUrl,
        emailError: sendResult.error,
      };
}

export async function listPlatformUsers(): Promise<PlatformUserListItem[]> {
  const admin = createAdminClient();
  const [profiles, invites, companies, guides, authUsers] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, display_name, role, company_id, guide_id, created_at"),
    admin
      .from("user_invites")
      .select("id, email, first_name, last_name, role, company_id, created_at")
      .is("accepted_at", null)
      .is("revoked_at", null),
    admin.from("companies").select("id, name, owner_email, owner_status, created_at"),
    admin.from("guides").select("id, company_id, name, email, status, created_at"),
    listAllAuthUsers(),
  ]);

  if (profiles.error) throw profiles.error;
  if (companies.error) throw companies.error;
  if (guides.error) throw guides.error;

  const profileRows = profiles.data ?? [];
  const inviteRows = invites.error ? [] : (invites.data ?? []);
  const companyRows = companies.data ?? [];
  const guideRows = guides.data ?? [];
  const companyById = new Map(companyRows.map((company) => [company.id, company]));
  const guideById = new Map(guideRows.map((guide) => [guide.id, guide]));
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const occupiedEmails = new Set(profileRows.map((profile) => normalizedEmail(profile.email)));
  const rows: PlatformUserListItem[] = profileRows.map((profile) => {
    const guide = profile.guide_id ? guideById.get(profile.guide_id) : null;
    const authUser = authById.get(profile.id);
    return {
      id: profile.id,
      name: profile.display_name || guide?.name || null,
      email: profile.email,
      role: profile.role as PlatformUserRole,
      companyName: profile.company_id ? companyById.get(profile.company_id)?.name ?? null : null,
      status: guide?.status === "deactivated" ? "deactivated" : "active",
      createdAt: profile.created_at,
      lastActiveAt: authUser?.last_sign_in_at ?? null,
    };
  });

  for (const invite of inviteRows) {
    const email = normalizedEmail(invite.email);
    if (occupiedEmails.has(email)) continue;
    occupiedEmails.add(email);
    rows.push({
      id: `invite:${invite.id}`,
      name: fullName(invite.first_name ?? "", invite.last_name ?? ""),
      email: invite.email,
      role: invite.role as PlatformUserRole,
      companyName: invite.company_id ? companyById.get(invite.company_id)?.name ?? null : null,
      status: "invited",
      createdAt: invite.created_at,
      lastActiveAt: null,
    });
  }

  // Keep legacy guide and first-company-owner invitations visible until they
  // are redeemed, without duplicating an address already represented above.
  for (const guide of guideRows) {
    const email = normalizedEmail(guide.email);
    if (guide.status !== "invited" || occupiedEmails.has(email)) continue;
    occupiedEmails.add(email);
    rows.push({
      id: `legacy-guide:${guide.id}`,
      name: guide.name,
      email: guide.email,
      role: "guide",
      companyName: companyById.get(guide.company_id)?.name ?? null,
      status: "invited",
      createdAt: guide.created_at,
      lastActiveAt: null,
    });
  }

  for (const company of companyRows) {
    const email = normalizedEmail(company.owner_email ?? "");
    if (!email || company.owner_status !== "invited" || occupiedEmails.has(email)) continue;
    occupiedEmails.add(email);
    rows.push({
      id: `legacy-company:${company.id}`,
      name: null,
      email,
      role: "company",
      companyName: company.name,
      status: "invited",
      createdAt: company.created_at,
      lastActiveAt: null,
    });
  }

  return rows.toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function deletePlatformUser(id: string): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  if (id.startsWith("invite:")) {
    const inviteId = id.slice(7);
    const { error } = await admin.from("user_invites").delete().eq("id", inviteId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  if (id.startsWith("legacy-guide:")) {
    const guideId = id.slice(13);
    const { error } = await admin.from("guides").delete().eq("id", guideId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  if (id.startsWith("legacy-company:")) {
    const companyId = id.slice(15);
    const { error } = await admin
      .from("companies")
      .update({ owner_status: "deactivated", owner_email: null })
      .eq("id", companyId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  // Regular user account (profiles + Supabase auth user)
  const { error: profileError } = await admin.from("profiles").delete().eq("id", id);
  if (profileError) return { success: false, error: profileError.message };

  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) {
    console.warn("Auth user delete notice:", authError.message);
  }

  return { success: true };
}

export async function resendPlatformUserInvite(
  id: string,
): Promise<{ success: boolean; inviteUrl?: string; emailSent?: boolean; error?: string }> {
  const admin = createAdminClient();

  if (id.startsWith("invite:")) {
    const inviteId = id.slice(7);
    const { data: invite, error } = await admin
      .from("user_invites")
      .select("*")
      .eq("id", inviteId)
      .single();

    if (error || !invite) return { success: false, error: "Invitation record not found." };

    let companyName: string | undefined;
    if (invite.company_id) {
      const { data: company } = await admin
        .from("companies")
        .select("name")
        .eq("id", invite.company_id)
        .maybeSingle();
      companyName = company?.name;
    }

    const rawToken = createUserInviteToken();
    const tokenHash = hashUserInviteToken(rawToken);

    await admin
      .from("user_invites")
      .update({ token_hash: tokenHash, updated_at: new Date().toISOString() })
      .eq("id", inviteId);

    let baseUrl: string;
    try {
      baseUrl = emailBaseUrl();
    } catch {
      return { success: true, emailSent: false, inviteUrl: `/join/${rawToken}` };
    }

    const inviteUrl = `${baseUrl}/join/${rawToken}`;
    const rendered = platformUserInviteEmail({
      firstName: invite.first_name || undefined,
      roleLabel: USER_ROLE_LABEL[invite.role as PlatformUserRole] ?? "Member",
      companyName,
      inviteUrl,
      baseUrl,
    });

    const sendResult = await sendEmail({ to: invite.email, ...rendered });
    return {
      success: true,
      emailSent: sendResult.ok,
      inviteUrl,
      error: sendResult.ok ? undefined : sendResult.error,
    };
  }

  if (id.startsWith("legacy-guide:")) {
    const guideId = id.slice(13);
    const { data: guide, error } = await admin
      .from("guides")
      .select("*, companies(name)")
      .eq("id", guideId)
      .single();

    if (error || !guide || !guide.email) {
      return { success: false, error: "Guide invitation not found or has no email." };
    }

    const inviteResult = await createPlatformInvite({
      email: guide.email,
      firstName: guide.name,
      lastName: "",
      role: "guide",
      companyId: guide.company_id,
      invitedBy: "system",
    });

    if (inviteResult.status === "created") {
      return {
        success: true,
        emailSent: inviteResult.emailSent,
        inviteUrl: inviteResult.inviteUrl,
        error: inviteResult.emailError,
      };
    }
    return { success: false, error: "Could not create invite for guide." };
  }

  return { success: false, error: "Only invited users can be resent an invitation." };
}

export async function sendPlatformUserPasswordReset(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const normalized = normalizedEmail(email);

  let baseUrl: string;
  try {
    baseUrl = emailBaseUrl();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Email not configured." };
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: normalized,
  });

  if (error) return { success: false, error: error.message };

  const resetUrl = data?.properties?.action_link ?? `${baseUrl}/set-password`;
  const rendered = passwordResetEmail({
    email: normalized,
    resetUrl,
    baseUrl,
  });

  const sendResult = await sendEmail({ to: normalized, ...rendered });
  return sendResult.ok ? { success: true } : { success: false, error: sendResult.error };
}

export async function togglePlatformUserStatus(
  id: string,
  nextStatus: PlatformUserStatus,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  if (id.startsWith("invite:") || id.startsWith("legacy-guide:") || id.startsWith("legacy-company:")) {
    if (nextStatus === "deactivated") {
      return deletePlatformUser(id);
    }
    return { success: true };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("guide_id, company_id, role")
    .eq("id", id)
    .maybeSingle();

  if (profile?.guide_id) {
    await admin
      .from("guides")
      .update({ status: nextStatus === "active" ? "active" : "deactivated" })
      .eq("id", profile.guide_id);
  }

  if (profile?.role === "company" && profile.company_id) {
    await admin
      .from("companies")
      .update({ owner_status: nextStatus === "active" ? "active" : "deactivated" })
      .eq("id", profile.company_id);
  }

  return { success: true };
}
