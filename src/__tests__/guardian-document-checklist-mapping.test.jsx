import "@testing-library/jest-dom";

import {
  CHECKLIST_DESCRIPTION_PREFIX,
  resolveChecklistItemIdFromDocument,
} from "../components/Guardian/DocumentChecklist";

describe("guardian checklist document mapping", () => {
  test("prefers explicit checklist metadata when a persisted checklist upload is restored", () => {
    expect(
      resolveChecklistItemIdFromDocument({
        description: `${CHECKLIST_DESCRIPTION_PREFIX}consent_form`,
        document_type: "other",
        original_filename: "consent-form.pdf",
      }),
    ).toBe("consent_form");

    expect(
      resolveChecklistItemIdFromDocument({
        checklist_item_id: "insurance",
        document_type: "other",
        original_filename: "card.pdf",
      }),
    ).toBe("insurance");
  });

  test("maps admin-uploaded shared infant documents back to the correct guardian checklist items", () => {
    expect(
      resolveChecklistItemIdFromDocument({
        document_type: "birth_certificate",
        original_filename: "birth-certificate.pdf",
      }),
    ).toBe("birth_cert");

    expect(
      resolveChecklistItemIdFromDocument({
        document_type: "other",
        description: "Parent/Guardian Valid ID",
        original_filename: "guardian-id.jpg",
      }),
    ).toBe("parent_id");

    expect(
      resolveChecklistItemIdFromDocument({
        document_type: "medical_record",
        description: "Mother's Medical Book",
        original_filename: "pink-book.pdf",
      }),
    ).toBe("medbook");

    expect(
      resolveChecklistItemIdFromDocument({
        document_type: "vaccination_card",
        description: "Previous Vaccination Records",
        original_filename: "vaccination-records.pdf",
      }),
    ).toBe("previous_records");

    expect(
      resolveChecklistItemIdFromDocument({
        document_type: "other",
        description: "Signed Consent Form",
        original_filename: "consent-form.pdf",
      }),
    ).toBe("consent_form");

    expect(
      resolveChecklistItemIdFromDocument({
        document_type: "other",
        description: "Health Insurance Card",
        original_filename: "philhealth-card.png",
      }),
    ).toBe("insurance");
  });
});
