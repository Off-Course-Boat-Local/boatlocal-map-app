"use server";

// The two Server Actions LoginForm.tsx / StudioSidebar.tsx call.
//
// requestMagicLinkAction sends a real Supabase magic link — no password,
// nothing invented on top of Supabase Auth. `shouldCreateUser: false` is
// the load-bearing line: Studio is invite-gated (a guide's account is
// created by src/app/join/[token]/actions.ts, a company's first user by
// Admin's onboarding flow), never self-serve, so a bare email with no
// existing auth user must never be able to mint itself a login here. The
// response is identical whether or not the email has an account, so this
// form can't be used to enumerate which addresses have Studio access.
//
// logoutAction ends the real Supabase session (`auth.signOut()`), which
// clears the `@supabase/ssr` cookies this same request's client wrote.

import { redirect } from "next/navigation";

import { currentOrigin } from "@/lib/studio/requestOrigin";
import { createClient } from "@/lib/supabase/server";

export interface LoginActionState {
  error?: string;
  sent?: boolean;
}

export async function requestMagicLinkAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) return { error: "Enter an email address." };

  const supabase = await createClient();
  const origin = await currentOrigin();

  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=/studio`,
    },
  });

  // Deliberately ignoring the error here (including "no account for this
  // email", which Supabase reports as an error when shouldCreateUser is
  // false, and rate-limit responses): surfacing any of that would let this
  // form enumerate which addresses have Studio access. A genuine Studio
  // user with a real account gets a real email; everyone else sees the
  // same "check your inbox" message and nothing arrives.
  return { sent: true };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/studio/login");
}
