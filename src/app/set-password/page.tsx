import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetPasswordForm from "@/components/auth/SetPasswordForm";
import MapAppMark from "@/components/MapAppMark";
import { bodyFontFamily } from "@/lib/fonts";

export const metadata = {
  title: "Set password — Map App",
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string }>;
}) {
  const { portal } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    // If not signed in yet (e.g. magic link not consumed or direct visit), redirect to appropriate login
    redirect(portal === "admin" ? "/admin/login" : "/studio/login");
  }

  const destination = portal === "admin" ? "/admin" : "/studio";

  return (
    <main
      style={{ fontFamily: bodyFontFamily }}
      className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-slate-950 p-6"
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-slate-900 dark:text-white">
          <MapAppMark iconSize={28} className="text-lg" />
        </div>

        <SetPasswordForm email={user.email} redirectTo={destination} />
      </div>
    </main>
  );
}
