import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

interface Row {
  metric: string;
  count: number;
}

describe("toCsv", () => {
  it("builds a header row plus one row per record, CRLF-joined", () => {
    const csv = toCsv<Row>(
      [
        { metric: "App opens", count: 10 },
        { metric: "Tips viewed", count: 20 },
      ],
      [
        { header: "Metric", value: (r) => r.metric },
        { header: "Count", value: (r) => r.count },
      ],
    );
    expect(csv).toBe("Metric,Count\r\nApp opens,10\r\nTips viewed,20");
  });

  it("returns just the header row for an empty dataset", () => {
    const csv = toCsv<Row>([], [{ header: "Metric", value: (r) => r.metric }]);
    expect(csv).toBe("Metric");
  });

  it("quotes and escapes cells containing commas, quotes, or newlines", () => {
    const csv = toCsv<Row>(
      [{ metric: 'Say "hi", please\nthanks', count: 1 }],
      [
        { header: "Metric", value: (r) => r.metric },
        { header: "Count", value: (r) => r.count },
      ],
    );
    expect(csv).toBe('Metric,Count\r\n"Say ""hi"", please\nthanks",1');
  });
});
