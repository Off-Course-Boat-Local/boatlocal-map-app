import { describe, expect, it } from "vitest";

import { parseOutreachCsv } from "./outreachCsv";

const HEADER =
  "Rank,Name,TA Rating,Review Count,Travelers Choice 2025,TA URL,Website,Phone,Email,Owner / Contact Name," +
  "LinkedIn URL,Instagram Handle,Instagram Followers,Facebook URL,Languages Served,Tour Type,Price From (EUR)," +
  "Year Founded,Booking Platforms,Owner Responds to Reviews,Latest Review Date,Enrichment Status,Notes";

function csv(rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("parseOutreachCsv — segments and identity fields", () => {
  it("defaults segment/source to operator/csv when no options and no Segment column", () => {
    const row =
      '1,360 Amsterdam Tours,5,16096,Yes,https://ta.example/360,360amsterdamtours.com,,,,,,,,,Private Walking,0,2014,,,,Fully Enriched,';
    const { records } = parseOutreachCsv(csv([row]));
    expect(records).toHaveLength(1);
    expect(records[0].segment).toBe("operator");
    expect(records[0].source).toBe("csv");
  });

  it("uses the caller's defaultSegment and source options", () => {
    const row = '1,Hotel V Nesplein,,,,,hotelvnesplein.com,,,,,,,,,,,,,,,,';
    const { records } = parseOutreachCsv(csv([row]), { defaultSegment: "hotel", source: "agent" });
    expect(records[0].segment).toBe("hotel");
    expect(records[0].source).toBe("agent");
  });

  it("normalizes the Website into website_domain", () => {
    const row = '1,X,,,,,https://www.example.com/tours?ref=1,,,,,,,,,,,,,,,,';
    const { records } = parseOutreachCsv(csv([row]));
    expect(records[0].website).toBe("https://www.example.com/tours?ref=1");
    expect(records[0].website_domain).toBe("example.com");
  });

  it("website_domain is null when there's no website", () => {
    const row = '1,X,,,,,,,,,,,,,,,,,,,,,';
    const { records } = parseOutreachCsv(csv([row]));
    expect(records[0].website_domain).toBeNull();
  });
});

describe("parseOutreachCsv — Segment and Google Place ID columns", () => {
  const HEADER_WITH_EXTRAS = `${HEADER},Segment,Google Place ID`;
  function csvWithExtras(rows: string[]): string {
    return [HEADER_WITH_EXTRAS, ...rows].join("\n");
  }

  it("reads a per-row Segment column, overriding the default", () => {
    const rows = [
      '1,Hotel V,,,,,hotelv.com,,,,,,,,,,,,,,,,,hotel,ChIJabc',
      '2,360 Tours,,,,,360.com,,,,,,,,,,,,,,,,,operator,ChIJdef',
    ];
    const { records } = parseOutreachCsv(csvWithExtras(rows), { defaultSegment: "operator" });
    expect(records[0].segment).toBe("hotel");
    expect(records[0].google_place_id).toBe("ChIJabc");
    expect(records[1].segment).toBe("operator");
  });

  it("falls back to defaultSegment when the Segment cell is blank or invalid", () => {
    const rows = [
      '1,A,,,,,a.com,,,,,,,,,,,,,,,,,,',
      '2,B,,,,,b.com,,,,,,,,,,,,,,,,,not-a-real-segment,',
    ];
    const { records } = parseOutreachCsv(csvWithExtras(rows), { defaultSegment: "hotel" });
    expect(records[0].segment).toBe("hotel");
    expect(records[1].segment).toBe("hotel");
  });
});
