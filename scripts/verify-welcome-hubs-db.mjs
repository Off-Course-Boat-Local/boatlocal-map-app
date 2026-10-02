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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

console.log("Verifying Welcome Hubs & Blocks database schema...\n");

// 1. Verify table accessibility via service role (admin)
const { count: hubsCount, error: hubsErr } = await admin
  .from("welcome_hubs")
  .select("*", { count: "exact", head: true });
if (hubsErr) {
  console.error("FAIL: welcome_hubs table query failed:", hubsErr.message);
  process.exit(1);
}
console.log(`PASS: welcome_hubs exists (${hubsCount ?? 0} rows)`);

const { count: blocksCount, error: blocksErr } = await admin
  .from("welcome_blocks")
  .select("*", { count: "exact", head: true });
if (blocksErr) {
  console.error("FAIL: welcome_blocks table query failed:", blocksErr.message);
  process.exit(1);
}
console.log(`PASS: welcome_blocks exists (${blocksCount ?? 0} rows)`);

// 2. Verify public read access via anon client
const { data: anonHubs, error: anonHubsErr } = await anon
  .from("welcome_hubs")
  .select("id, title, is_active");
if (anonHubsErr) {
  console.error("FAIL: anon select on welcome_hubs failed:", anonHubsErr.message);
  process.exit(1);
}
console.log(`PASS: anon public read on welcome_hubs allowed (${anonHubs.length} rows returned)`);

const { data: anonBlocks, error: anonBlocksErr } = await anon
  .from("welcome_blocks")
  .select("id, block_type, display_order");
if (anonBlocksErr) {
  console.error("FAIL: anon select on welcome_blocks failed:", anonBlocksErr.message);
  process.exit(1);
}
console.log(`PASS: anon public read on welcome_blocks allowed (${anonBlocks.length} rows returned)`);

// 3. Test insert, relational constraints, unique constraints, and cleanup
const { data: guide, error: guideErr } = await admin
  .from("guides")
  .select("id, company_id")
  .limit(1)
  .single();
if (guideErr || !guide) {
  console.error("FAIL: Could not fetch a guide for constraint verification:", guideErr?.message);
  process.exit(1);
}

// Test insert a dummy welcome hub
const testHubTitle = `__test_hub_${Date.now()}__`;
const { data: insertedHub, error: insertHubErr } = await admin
  .from("welcome_hubs")
  .insert({
    company_id: guide.company_id,
    guide_id: guide.id,
    title: testHubTitle,
    intro: "Test welcome hub intro",
    is_active: false,
  })
  .select()
  .single();

if (insertHubErr) {
  console.error("FAIL: Inserting test welcome_hub failed:", insertHubErr.message);
  process.exit(1);
}
console.log("PASS: Inserted test welcome_hub:", insertedHub.id);

// Test inserting a welcome block linked to the hub
const { data: insertedBlock, error: insertBlockErr } = await admin
  .from("welcome_blocks")
  .insert({
    hub_id: insertedHub.id,
    block_type: "review_prompt",
    display_order: 1,
    content: { promptText: "How was your tour?" },
  })
  .select()
  .single();

if (insertBlockErr) {
  console.error("FAIL: Inserting test welcome_block failed:", insertBlockErr.message);
  // cleanup hub
  await admin.from("welcome_hubs").delete().eq("id", insertedHub.id);
  process.exit(1);
}
console.log("PASS: Inserted test welcome_block:", insertedBlock.id);

// Test unique constraint: inserting another hub for same (company_id, guide_id) must fail
const { error: duplicateHubErr } = await admin
  .from("welcome_hubs")
  .insert({
    company_id: guide.company_id,
    guide_id: guide.id,
    title: "Duplicate Hub",
  });

if (duplicateHubErr) {
  console.log("PASS: Unique constraint (company_id, guide_id) enforced as expected:", duplicateHubErr.message);
} else {
  console.error("FAIL: Duplicate hub insert succeeded (unique constraint check failed)");
  process.exit(1);
}

// Cleanup test records (cascade delete on hub should delete block)
const { error: deleteErr } = await admin
  .from("welcome_hubs")
  .delete()
  .eq("id", insertedHub.id);

if (deleteErr) {
  console.error("FAIL: Cleanup failed:", deleteErr.message);
  process.exit(1);
}

const { data: orphanedBlock } = await admin
  .from("welcome_blocks")
  .select("id")
  .eq("id", insertedBlock.id);

if (orphanedBlock && orphanedBlock.length > 0) {
  console.error("FAIL: Cascade delete on welcome_blocks failed (block still exists)");
  process.exit(1);
}
console.log("PASS: Cascade delete verified (block automatically deleted when hub was deleted)");

console.log("\nALL VERIFICATION CHECKS PASSED!");
