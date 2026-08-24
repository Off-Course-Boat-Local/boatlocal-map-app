// Public page, no session required. Redirects away if a session already
// exists so a signed-in user hitting /studio/login lands back on the
// Dashboard instead of seeing the form again.

import { redirect } from "next/navigation";

import LoginForm from "@/components/studio/LoginForm";
import { getDevSession } from "@/lib/studio/devAuth";
import { bodyFontFamily } from "@/lib/fonts";
import "../studio-theme.css";

export const metadata = {
  title: "Studio sign in — Map App",
};

export default async function StudioLoginPage() {
  const session = await getDevSession();
  if (session) {
    redirect("/studio");
  }

  return (
    <main
      style={{ fontFamily: bodyFontFamily }}
      className="studio-root flex min-h-dvh items-center justify-center bg-[var(--studio-bg)] p-6"
    >
      <LoginForm />
    </main>
  );
}
