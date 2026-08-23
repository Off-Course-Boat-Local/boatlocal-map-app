import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const tables = [
  "companies",
  "guides",
  "profiles",
  "boat_tours",
  "company_boat_features",
  "recommendations",
  "guest_sessions",
  "events",
];

for (const t of tables) {
  const { count, error } = await admin.from(t).select("*", { count: "exact", head: true });
  console.log(error ? `${t}: ERROR ${error.message}` : `${t}: ${count} rows`);
}

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: anonCompanies, error: anonCompaniesErr } = await anon.from("companies").select("id, status");
console.log("\nanon read of companies:", anonCompaniesErr?.message ?? JSON.stringify(anonCompanies));

const { data: anonProfiles, error: anonProfilesErr } = await anon.from("profiles").select("*");
console.log("anon read of profiles (should be empty/denied):", anonProfilesErr?.message ?? JSON.stringify(anonProfiles));

const { data: firstCompany } = await admin.from("companies").select("id").limit(1).single();
const { data: rpcPins, error: rpcErr } = await admin.rpc("guest_map_pins", { p_company_id: firstCompany?.id });
console.log("\nguest_map_pins RPC:", rpcErr?.message ?? `${rpcPins?.length} pins`);
