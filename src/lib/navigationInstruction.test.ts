import { describe, expect, it } from "vitest";
import { simplifyInstruction } from "./navigationInstruction";

describe("simplifyInstruction", () => {
  it("strips cardinal direction and extracts target destination in English", () => {
    expect(
      simplifyInstruction("Head south on Herenmarkt toward Brouwersgracht"),
    ).toBe("towards Brouwersgracht");

    expect(
      simplifyInstruction("Head west toward Singel"),
    ).toBe("towards Singel");

    expect(
      simplifyInstruction("Head north on Damrak"),
    ).toBe("Walk along Damrak");
  });

  it("handles Dutch instructions without cardinal confusion", () => {
    expect(
      simplifyInstruction("Ga in zuidelijke richting op de Herenmarkt naar de Brouwersgracht"),
    ).toBe("Richting de Brouwersgracht");

    expect(
      simplifyInstruction("Vertrek in noordelijke richting op Damrak"),
    ).toBe("Volg Damrak");
  });

  it("handles German instructions", () => {
    expect(
      simplifyInstruction("Nach Süden auf Herenmarkt Richtung Brouwersgracht starten"),
    ).toBe("Richtung Brouwersgracht");
  });

  it("preserves regular turn instructions unchanged", () => {
    expect(simplifyInstruction("Turn right onto Wolvenstraat")).toBe("Turn right onto Wolvenstraat");
    expect(simplifyInstruction("Continue onto Herengracht")).toBe("Continue onto Herengracht");
    expect(simplifyInstruction("Destination will be on the left")).toBe("Destination will be on the left");
  });
});
