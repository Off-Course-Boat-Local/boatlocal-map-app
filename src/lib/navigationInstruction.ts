/**
 * Simplifies turn-by-turn navigation instructions for pedestrians and cyclists.
 *
 * Google's Routes API frequently starts routes with sentences like:
 *   "Head south on Herenmarkt toward Brouwersgracht"
 *
 * Pedestrians do not know or care about cardinal directions (north/south/etc.)
 * and are already standing on the street. What they need is the direction
 * they should walk into: "towards Brouwersgracht".
 */
export function simplifyInstruction(instruction: string): string {
  if (!instruction) return "";

  const trimmed = instruction.trim();

  // English:
  // "Head [direction] on [Street] toward(s) [Target]" or "Head toward(s) [Target]"
  const enToward = trimmed.match(
    /^head\s+(?:north|south|east|west|northeast|northwest|southeast|southwest)?\s*(?:on\s+[^]+?)?\s+toward(?:s)?\s+([^]+)$/i,
  );
  if (enToward && enToward[1]) {
    return `towards ${enToward[1].trim()}`;
  }

  // "Head [direction] on [Street]" without a toward target -> "Walk along [Street]"
  const enOn = trimmed.match(
    /^head\s+(?:north|south|east|west|northeast|northwest|southeast|southwest)\s+on\s+([^]+)$/i,
  );
  if (enOn && enOn[1]) {
    return `Walk along ${enOn[1].trim()}`;
  }

  // Dutch:
  // "Ga/Loop/Vertrek in [zuidelijke] richting op [Straat] naar/richting [Target]"
  const nlToward = trimmed.match(
    /^(?:ga|loop|vertrek)\s+(?:in\s+[^]+?\s+richting\s+)?(?:op\s+[^]+?\s+)?(?:naar|richting)\s+([^]+)$/i,
  );
  if (nlToward && nlToward[1]) {
    return `Richting ${nlToward[1].trim()}`;
  }

  // "Ga/Loop/Vertrek in [zuidelijke] richting op [Straat]" -> "Volg [Straat]"
  const nlOn = trimmed.match(
    /^(?:ga|loop|vertrek)\s+in\s+[^]+?\s+richting\s+op\s+([^]+)$/i,
  );
  if (nlOn && nlOn[1]) {
    return `Volg ${nlOn[1].trim()}`;
  }

  // German:
  // "Nach [Süden] auf [Street] Richtung [Target] (starten)"
  const deToward = trimmed.match(
    /^(?:nach\s+[^]+?\s+)?(?:auf\s+[^]+?\s+)?richtung\s+([^]+?)(?:\s+starten)?$/i,
  );
  if (deToward && deToward[1]) {
    return `Richtung ${deToward[1].trim()}`;
  }

  // French:
  // "Prendre la direction [sud] sur [Street] vers [Target]"
  const frToward = trimmed.match(
    /^(?:prendre\s+la\s+direction\s+[^]+?\s+)?(?:sur\s+[^]+?\s+)?vers\s+([^]+)$/i,
  );
  if (frToward && frToward[1]) {
    return `Vers ${frToward[1].trim()}`;
  }

  // Spanish:
  // "Dirígete al [sur] por [Street] hacia [Target]"
  const esToward = trimmed.match(
    /^(?:dirígete|dirigete)\s+(?:al\s+[^]+?\s+)?(?:por\s+[^]+?\s+)?hacia\s+([^]+)$/i,
  );
  if (esToward && esToward[1]) {
    return `Hacia ${esToward[1].trim()}`;
  }

  return trimmed;
}
