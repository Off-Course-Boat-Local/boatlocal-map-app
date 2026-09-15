// Prefill text for the outreach compose box (OutreachComposeForm.tsx)
// Based directly on the proven outreach emails sent to King Bikes, Yellow Bike,
// and Amsterbike, highlighting:
// - Custom branded digital map with hidden gems
// - TripAdvisor review generation
// - Social proof: "We are already working with two other parties in Amsterdam"
// - 100% free model (monetized only via optional boat tour bookings)
// - 15-minute preview CTA
// - Proper Dutch / English language selection

import type { OutreachProspect } from "@/lib/data/outreach";

/** 1 = first email, 2 = first follow-up, 3 = last (detach) follow-up. */
export type OutreachTouch = 1 | 2 | 3;

export interface OutreachDraft {
  subject: string;
  body: string;
  touch: OutreachTouch;
}

export function outreachTouchForPriorEmails(priorEmails: number): OutreachTouch {
  if (priorEmails <= 0) return 1;
  if (priorEmails === 1) return 2;
  return 3;
}

function firstName(prospect: OutreachProspect): string | null {
  const first = prospect.contactName?.trim().split(/\s+/)[0];
  if (!first) return null;
  if (/^team$/i.test(first) || /team$/i.test(prospect.contactName ?? "")) return null;
  return first;
}

function isDutch(prospect: OutreachProspect): boolean {
  const langs = (prospect.languages ?? "").toLowerCase();
  const notes = (prospect.notes ?? "").toLowerCase();
  const name = prospect.name.toLowerCase();
  if (langs.includes("dutch") || langs.includes("nederlands")) return true;
  if (notes.includes("gesproken") || notes.includes("telefoon") || notes.includes("nederlands")) return true;
  if (name.includes("fiets") || name.includes("kaas") || name.includes("rondvaart")) return true;
  return false;
}

function defaultSubject(prospect: OutreachProspect, touch: OutreachTouch): string {
  const dutch = isDutch(prospect);
  if (touch === 1) {
    return dutch
      ? `Gratis digitale stadsgids & review-tool voor ${prospect.name}`
      : `Boat Local x ${prospect.name} | Collaboration idea`;
  }
  return dutch
    ? `Re: Gratis digitale stadsgids & review-tool voor ${prospect.name}`
    : `Re: Boat Local x ${prospect.name} | Collaboration idea`;
}

function firstEmail(prospect: OutreachProspect): string {
  const name = firstName(prospect);
  const dutch = isDutch(prospect);

  if (prospect.segment === "hotel") {
    if (dutch) {
      return [
        name ? `Hi ${name},` : "Hi,",
        "",
        "Mijn naam is Beer van boatlocal.nl.",
        "",
        `Bij dezen stuur ik wat meer informatie over de digitale gastenkaart die ik heb ontwikkeld voor hotels in Amsterdam.`,
        "",
        `Met deze web-app (geheel in de eigen stijl van ${prospect.name}) geef je gasten via een simpele QR-code direct een interactieve stadsgids mee met verborgen parels, lokale aanbevelingen en activiteiten in de buurt.`,
        "",
        "Inmiddels werken we al samen met twee andere partijen in Amsterdam die de kaart inzetten voor hun gasten.",
        "",
        `Het gebruik van de app is voor ${prospect.name} volledig gratis en vergt geen onderhoud van jullie team.`,
        "",
        "Mocht het je leuk lijken kan ik binnenkort 15 minuten langs komen om de app te laten zien. Heb je toevallig ergens een gaatje deze week?",
        "",
        "Met vriendelijke groet,",
        "Beer Zoomers",
        "boatlocal.nl",
      ].join("\n");
    }

    return [
      name ? `Hi ${name},` : `Hi ${prospect.name} team,`,
      "",
      "My name is Beer Zoomers from boatlocal.nl.",
      "",
      `I’m reaching out with some quick information about the custom digital guest map we’ve developed for hotels in Amsterdam.`,
      "",
      `With this web app—fully customized for ${prospect.name}—your guests scan a simple QR code to access curated local gems, neighborhood cafes, and activities around the city.`,
      "",
      "We are already working with two other parties in Amsterdam who are using the map for their guests.",
      "",
      `It is completely free for ${prospect.name} and requires zero maintenance from your team.`,
      "",
      "I’d love to pop by for 15 minutes to show you a quick preview. Would you have a moment this week for a brief visit?",
      "",
      "Best regards,",
      "Beer Zoomers",
      "boatlocal.nl",
    ].join("\n");
  }

  // Operators (Bike, Walking, Food tours)
  if (dutch) {
    return [
      name ? `Hi ${name},` : "Hi,",
      "",
      "Mijn naam is Beer van boatlocal.nl.",
      "",
      `Bij dezen stuur ik wat meer informatie over de digitale kaart die ik heb ontwikkeld voor tour operators in Amsterdam.`,
      "",
      `Met deze web-app (geheel in de eigen huisstijl van ${prospect.name}) geef je gasten voorafgaand aan de verhuur of na de tour een interactieve kaart mee. Hierin kun je eenvoudig je eigen verborgen parels toevoegen — zoals jullie favoriete lokale cafés, winkels en musea — die toeristen anders niet snel ontdekken. Daarnaast helpt de app je actief om meer positieve reviews op onder andere TripAdvisor te verzamelen.`,
      "",
      "Inmiddels werken we al samen met twee andere partijen in Amsterdam die de kaart inzetten voor hun gasten.",
      "",
      `Het gebruik van de app is voor ${prospect.name} volledig gratis. Boat Local verdient hier namelijk pas aan wanneer gasten via de kaart een boottochtje bij ons boeken.`,
      "",
      "Mocht het je leuk lijken kan ik binnenkort 15 minuten langs komen om de app te laten zien. Schikt het jou bijvoorbeeld deze week voor een korte kennismaking?",
      "",
      "Met vriendelijke groet,",
      "Beer Zoomers",
      "boatlocal.nl",
    ].join("\n");
  }

  return [
    name ? `Hi ${name},` : `Hi ${prospect.name} team,`,
    "",
    "My name is Beer Zoomers from boatlocal.nl. I’m reaching out with a bit more information about a custom digital map I’ve developed for tour operators here in Amsterdam.",
    "",
    `With this web app—fully customized in ${prospect.name}'s own brand identity—you can share an interactive city guide with your guests before or after their tour. You can easily add your own hidden gems, like your favorite neighborhood cafes, shops, and museums that tourists usually miss. On top of that, the app actively encourages your guests to leave positive reviews for your company on platforms like TripAdvisor.`,
    "",
    "We are already working with two other parties in Amsterdam who are using the map for their guests.",
    "",
    `It’s completely free for ${prospect.name} to use. Boat Local only earns a fee if one of your guests decides to book a canal cruise with us through the map while exploring the city.`,
    "",
    "I’d love to pop by for 15 minutes to show you a quick preview of how it works. Would you have a moment this week for a quick visit?",
    "",
    "Best regards,",
    "Beer Zoomers",
    "boatlocal.nl",
  ].join("\n");
}

function firstFollowUp(prospect: OutreachProspect): string {
  const name = firstName(prospect);
  const dutch = isDutch(prospect);

  if (dutch) {
    return [
      name ? `Hi ${name},` : "Hi,",
      "",
      "Heb je toevallig al gelegenheid gehad om naar mijn vorige berichtje te kijken?",
      "",
      `We hebben de digitale preview voor ${prospect.name} al grotendeels klaargezet. We werken inmiddels al samen met twee andere partijen in de stad en laten je graag in 15 minuten zien hoe het eruitziet voor jullie gasten.`,
      "",
      "Schikt het jou ergens deze week voor een korte demo?",
      "",
      "Met vriendelijke groet,",
      "Beer Zoomers",
      "boatlocal.nl",
    ].join("\n");
  }

  return [
    name ? `Hi ${name},` : `Hi ${prospect.name} team,`,
    "",
    "Just checking in to see if you had a chance to look at my previous email.",
    "",
    `We already have a preliminary digital preview set up for ${prospect.name}. We are already working with two other operators in Amsterdam and would love to show you a quick 15-minute preview of how it works for your guests.`,
    "",
    "Would you have a quick slot open this week?",
    "",
    "Best regards,",
    "Beer Zoomers",
    "boatlocal.nl",
  ].join("\n");
}

function lastFollowUp(prospect: OutreachProspect): string {
  const name = firstName(prospect);
  const dutch = isDutch(prospect);

  if (dutch) {
    return [
      name ? `Hi ${name},` : "Hi,",
      "",
      `Geen enkel probleem als een digitale kaart op dit moment geen prioriteit heeft voor ${prospect.name}!`,
      "",
      "Laat gerust weten of we dit voor nu kunnen parkeren, of dat het later in het seizoen beter schikt.",
      "",
      "Met vriendelijke groet,",
      "Beer Zoomers",
      "boatlocal.nl",
    ].join("\n");
  }

  return [
    name ? `Hi ${name},` : `Hi ${prospect.name} team,`,
    "",
    `No worries at all if a digital map is not a priority for ${prospect.name} right now!`,
    "",
    "Feel free to let me know if we should park this for now or reconnect later in the season.",
    "",
    "Best regards,",
    "Beer Zoomers",
    "boatlocal.nl",
  ].join("\n");
}

export function buildDefaultOutreachDraft(
  prospect: OutreachProspect,
  options: { touch?: OutreachTouch } = {},
): OutreachDraft {
  const touch = options.touch ?? 1;
  const subject = defaultSubject(prospect, touch);
  const body = touch === 1 ? firstEmail(prospect) : touch === 2 ? firstFollowUp(prospect) : lastFollowUp(prospect);
  return { subject, body, touch };
}
