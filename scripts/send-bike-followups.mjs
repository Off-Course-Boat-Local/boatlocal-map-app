import { Resend } from "resend";
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

const resend = new Resend(env.RESEND_API_KEY);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPlainOutreachEmail(subject, bodyText) {
  const html = bodyText
    .split(/\n{2,}/)
    .map((paragraph) => escapeHtml(paragraph).replace(/\n/g, "<br />"))
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:14.5px;line-height:22px;color:#1a1c22;">${paragraph}</p>`,
    )
    .join("");

  return {
    subject,
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    ${html}
  </body>
</html>`,
    text: bodyText,
  };
}

// Next action scheduled for next Tuesday (29 Sep 2026), right after vacation week
function nextWeekDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

const followups = [
  {
    name: "King Bikes",
    prospectId: "50aba0d8-1639-4998-b44e-3812842fe854",
    to: "info@kingbikes.nl",
    subject: "Re: Vrijdag gesproken / Digitale kaart voor King Bikes",
    body: `Hi Mikael,

Heb je toevallig al gelegenheid gehad om naar mijn vorige berichtje te kijken?

Goed om te weten: we kunnen er voor King Bikes ook jullie eigen custom fietsroutes in zetten, zodat huurders onderweg gemakkelijk jullie routes kunnen navigeren vanaf hun telefoon.

Ik wil heel graag even bij jullie in de zaak langskomen om de preview live te laten zien en kennis te maken. Ik ben toevallig even een weekje weg, maar schikt het jou ergens volgende week voor een korte kop koffie?

Met vriendelijke groet,
Beer Zoomers
boatlocal.nl
06 166 797 53`,
  },
  {
    name: "Yellow Bike",
    prospectId: "449be45a-44ef-4f4a-8baf-a1cfa2f75446",
    to: "info@yellowbike.nl",
    subject: "Re: Gratis digitale stadsgids & review-tool voor Yellow Bike",
    body: `Hi Guido,

Heb je al even kunnen kijken naar het idee van de digitale gastenkaart voor Yellow Bike?

Een mooie toevoeging voor jullie: we kunnen er jullie eigen vaste fietsroutes in laden. Huurders kunnen die dan heel makkelijk openen en onderweg volgen.

Ik wil heel graag even bij jullie op de Nieuwezijds langskomen om het op een scherm te laten zien. Schikt het jou om ergens volgende week (als ik terug ben van een korte vakantie) even 15 minuten af te spreken?

Met vriendelijke groet,
Beer Zoomers
boatlocal.nl
06 166 797 53`,
  },
  {
    name: "Mike's Bike Tours Amsterdam",
    prospectId: "b650bbbc-f834-474a-887b-d32e99d204a7",
    to: "mikestoursamsterdam@gmail.com",
    subject: "Re: Boat Local x Mike's Bike Tours Amsterdam | Collaboration idea",
    body: `Hi Ashton,

Did you have a chance to look at my previous email about the digital guest map?

One great feature specifically for bike rental: you can easily add your own custom bike routes into the app, so renters can navigate your curated paths around Amsterdam.

I’d really love to drop by your shop to show you a quick preview and hear your thoughts. I’m away for a short holiday this week, but would you be open to grabbing a quick coffee sometime next week?

Best regards,
Beer Zoomers
boatlocal.nl
+31 6 166 797 53`,
  },
  {
    name: "Amsterbike",
    prospectId: "86471f25-6d31-4913-ac8b-581e874c1aff",
    to: "info@amsterbike.eu",
    subject: "Re: Boat Local x Amsterbike | Collaboration idea",
    body: `Goedemiddag,

Hebben jullie nog een kijkje kunnen nemen op de interactieve kaart?

We kunnen er voor Amsterbike ook jullie eigen fietsroutes voor huurders in zetten, zodat toeristen jullie aanbevolen routes direct op hun telefoon kunnen volgen.

Ik wil heel graag even bij jullie in de winkel langskomen om dit kort te laten zien en kennis te maken. Schikt het om ergens volgende week (na mijn korte vakantie) een kwartiertje af te spreken?

Met vriendelijke groet,
Beer Zoomers
boatlocal.nl
06 166 797 53`,
  },
];

async function run() {
  console.log(`Starting follow-up dispatch for ${followups.length} prospects...`);

  for (const item of followups) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Sending to: ${item.name} <${item.to}>...`);
    const rendered = renderPlainOutreachEmail(item.subject, item.body);

    const { data, error: sendError } = await resend.emails.send({
      from: env.RESEND_FROM,
      to: item.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: env.RESEND_REPLY_TO || undefined,
    });

    if (sendError) {
      console.error(`FAILED sending to ${item.name}:`, sendError);
      continue;
    }

    console.log(`✓ Email sent successfully! Resend ID: ${data.id}`);

    // 1. Log event in outreach_events
    const { error: eventError } = await admin.from("outreach_events").insert({
      prospect_id: item.prospectId,
      event_type: "email_sent",
      body: `${item.subject}\n\n${item.body}`,
    });

    if (eventError) {
      console.error(`Error logging event for ${item.name}:`, eventError);
    } else {
      console.log(`✓ Event logged in outreach timeline.`);
    }

    // 2. Update outreach_prospects
    const { error: updateError } = await admin
      .from("outreach_prospects")
      .update({
        status: "emailed",
        last_contacted_at: new Date().toISOString(),
        next_action_type: "call",
        next_action_due_at: nextWeekDate(),
      })
      .eq("id", item.prospectId);

    if (updateError) {
      console.error(`Error updating prospect for ${item.name}:`, updateError);
    } else {
      console.log(`✓ Prospect status & next action updated (Call scheduled for next week).`);
    }
  }

  console.log(`\nAll follow-ups processed!`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
