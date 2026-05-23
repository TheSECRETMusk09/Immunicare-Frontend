import infantService from "../services/infantService";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    createInfant: jest.fn(),
  },
}));

describe("infantService admin payload normalization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.createInfant.mockResolvedValue({
      success: true,
      data: { id: 1 },
    });
  });

  test("preserves saved admin infant fields while normalizing legacy aliases", async () => {
    await infantService.create({
      first_name: "Baby",
      last_name: "Example",
      guardian_id: "",
      birth_length: "50",
      birthplace: "City Hospital",
      blood_type: "O+",
      notes: "Recorded from admin dashboard",
    });

    const payload = apiClient.createInfant.mock.calls[0][0];

    expect(payload).toEqual(
      expect.objectContaining({
        first_name: "Baby",
        last_name: "Example",
        guardian_id: null,
        birth_height: "50",
        place_of_birth: "City Hospital",
        blood_type: "O+",
        notes: "Recorded from admin dashboard",
      }),
    );
    expect(payload).not.toHaveProperty("birth_length");
    expect(payload).not.toHaveProperty("birthplace");
  });
});
