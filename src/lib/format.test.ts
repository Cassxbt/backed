import { describe, expect, it } from "vitest";
import { pct, ratio, usd } from "./format";

describe("pct", () => {
  it("never rounds a partial share up to 100%", () => {
    expect(pct(0.99996)).toBe(">99.9%");
    expect(pct(1)).toBe("100.0%");
  });

  it("never rounds a non-zero share down to 0%", () => {
    expect(pct(0.0003)).toBe("<0.1%");
    expect(pct(0)).toBe("0.0%");
  });

  it("formats ordinary shares", () => {
    expect(pct(0.025)).toBe("2.5%");
    expect(pct(null)).toBe("—");
  });
});

describe("usd and ratio", () => {
  it("compacts large values", () => {
    expect(usd(551_100_000)).toBe("$551M");
    expect(usd(282_200_000_000)).toBe("$282B");
    expect(usd(12_128_849_217_213)).toBe("$12.1T");
    expect(ratio(48.9)).toBe("48.9×");
    expect(ratio(0.0003)).toBe("<0.01×");
  });
});
