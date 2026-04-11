import {
  buildFefoBatchOptions,
  buildNextDueVaccinationOptions,
  normalizeInfant,
} from "../utils/adminDataAdapters";

describe("Phase 3 admin infant normalization", () => {
  test("normalizes transfer workflow and imported-history summary fields", () => {
    const infant = normalizeInfant({
      id: 1,
      first_name: "Jamie",
      last_name: "Doe",
      sex: "F",
      completed_vaccinations: 4,
      pending_vaccinations: 2,
      imported_vaccinations: 1,
      latest_transfer_case_status: "for_validation",
      latest_transfer_source_facility: "Other Health Center",
    });

    expect(infant.validation_status).toBe("for_validation");
    expect(infant.workflow_status).toBe("needs_review");
    expect(infant.imported_vaccinations).toBe(1);
    expect(infant.latest_transfer_source_facility).toBe("Other Health Center");
  });
});

describe("Phase 4 next-dose selection helpers", () => {
  test("returns only the next pending dose per vaccine after completed doses", () => {
    const options = buildNextDueVaccinationOptions({
      infantDob: "2025-01-01",
      schedules: [
        {
          id: 11,
          vaccine_id: 101,
          vaccine_name: "Penta Valent",
          dose_number: 1,
          total_doses: 3,
          age_in_months: 1,
        },
        {
          id: 12,
          vaccine_id: 101,
          vaccine_name: "Penta Valent",
          dose_number: 2,
          total_doses: 3,
          age_in_months: 2,
        },
        {
          id: 13,
          vaccine_id: 101,
          vaccine_name: "Penta Valent",
          dose_number: 3,
          total_doses: 3,
          age_in_months: 3,
        },
        {
          id: 21,
          vaccine_id: 202,
          vaccine_name: "BCG",
          dose_number: 1,
          total_doses: 1,
          age_in_months: 0,
        },
      ],
      records: [
        {
          id: 1,
          vaccine_id: 101,
          vaccine_name: "Penta Valent",
          dose_no: 1,
          admin_date: "2025-02-01",
          status: "completed",
        },
        {
          id: 2,
          vaccine_id: 202,
          vaccine_name: "BCG",
          dose_no: 1,
          admin_date: "2025-01-01",
          status: "completed",
        },
      ],
      referenceDate: new Date("2025-03-10T00:00:00.000Z"),
    });

    expect(options).toHaveLength(1);
    expect(options[0].vaccine_id).toBe(101);
    expect(options[0].dose_number).toBe(2);
  });
});

describe("Phase 6 FEFO batch helpers", () => {
  test("returns FEFO-sorted selectable batches with matched inventory sheet links", () => {
    const options = buildFefoBatchOptions({
      vaccineId: 2,
      clinicId: 7,
      referenceDate: "2026-03-01",
      inventoryRecords: [
        {
          id: 21,
          vaccine_id: 2,
          clinic_id: 7,
          lot_batch_number: "PENTA-FEFO-001",
          stock_on_hand: 9,
        },
        {
          id: 22,
          vaccine_id: 2,
          clinic_id: 7,
          lot_batch_number: "PENTA-LATER-002",
          stock_on_hand: 6,
        },
      ],
      batches: {
        clinicId: 7,
        batches: [
          {
            id: 302,
            vaccine_id: 2,
            lot_no: "PENTA-LATER-002",
            qty_current: 6,
            expiry_date: "2026-06-15",
          },
          {
            id: 301,
            vaccine_id: 2,
            lot_no: "PENTA-FEFO-001",
            qty_current: 9,
            expiry_date: "2026-04-05",
          },
          {
            id: 399,
            vaccine_id: 2,
            lot_no: "PENTA-EXPIRED-003",
            qty_current: 4,
            expiry_date: "2026-02-15",
          },
        ],
      },
    });

    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({
      batch_id: 301,
      lot_batch_number: "PENTA-FEFO-001",
      matched_inventory_record_id: 21,
      is_fefo_recommended: true,
      selection_disabled: false,
    });
    expect(options[1]).toMatchObject({
      batch_id: 302,
      lot_batch_number: "PENTA-LATER-002",
      matched_inventory_record_id: 22,
      is_fefo_recommended: false,
      selection_disabled: false,
    });
  });

  test("keeps available-lots responses selectable when the backend omits vaccine_id", () => {
    const options = buildFefoBatchOptions({
      vaccineId: 4,
      clinicId: 203,
      referenceDate: "2026-04-10",
      inventoryRecords: [
        {
          id: 88,
          vaccine_id: 4,
          clinic_id: 203,
          lot_batch_number: "PENTA-FEFO-004",
          stock_on_hand: 12,
        },
      ],
      batches: [
        {
          batch_id: 501,
          lot_number: "PENTA-FEFO-004",
          available_quantity: 12,
          expiry_date: "2026-07-01",
        },
      ],
    });

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      batch_id: 501,
      vaccine_id: 4,
      matched_inventory_record_id: 88,
      selection_disabled: false,
      is_fefo_recommended: true,
    });
  });
});
