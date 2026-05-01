import {
  buildInfantSearchText,
  matchesTokenizedTextSearch,
} from "../utils/infantIdentity";

describe("infant identity search helpers", () => {
  const infant = {
    first_name: "Christian",
    middle_name: "Antonio",
    last_name: "Samorin",
    control_number: "INF-2026-000001",
    dob: "2026-04-28",
  };

  test("matches surname-only and mixed-order name queries", () => {
    const searchText = buildInfantSearchText(infant);

    expect(matchesTokenizedTextSearch(searchText, "samorin")).toBe(true);
    expect(matchesTokenizedTextSearch(searchText, "christian")).toBe(true);
    expect(matchesTokenizedTextSearch(searchText, "samorin christian")).toBe(true);
    expect(matchesTokenizedTextSearch(searchText, "christian samorin")).toBe(true);
  });

  test("matches middle-name fragments and middle-initial formats", () => {
    const searchText = buildInfantSearchText(infant);

    expect(matchesTokenizedTextSearch(searchText, "anton")).toBe(true);
    expect(matchesTokenizedTextSearch(searchText, "christian a samorin")).toBe(true);
    expect(matchesTokenizedTextSearch(searchText, "samorin, christian a.")).toBe(true);
  });
});
