import { describe, expect, it } from "vitest";
import { isBase58Check } from "./evidence";

describe("isBase58Check", () => {
  it("accepts valid legacy and script addresses", () => {
    expect(isBase58Check("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(true);
    expect(isBase58Check("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy")).toBe(true);
  });

  it("rejects the same addresses lowercased or altered", () => {
    expect(isBase58Check("1a1zp1ep5qgefi2dmptftl5slmv7divfna")).toBe(false);
    expect(isBase58Check("3j98t1wpez73cnmqviecrnyiwrnqrhwnly")).toBe(false);
    expect(isBase58Check("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb")).toBe(false);
  });
});
