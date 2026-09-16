import { describe, expect, it } from "vitest";
import { CONTRACTS_SCAFFOLD } from "@inkdown/contracts";

describe("contracts scaffold", () => {
  it("exports CONTRACTS_SCAFFOLD", () => {
    expect(CONTRACTS_SCAFFOLD).toBe("contracts");
  });
});
