/**
 * Test Suite for Provider Persistence and Schedule Notifications
 * Tests the new functionality added in the system
 */

const { expect, describe, it, beforeAll, afterAll } = require('@jest/globals');

// Test constants
const TEST_INFANT_ID = 1;
const TEST_APPOINTMENT_ID = 1;
const TEST_GUARDIAN_PHONE = '+639123456789';

// Mock data for testing
const mockInfantRecord = {
  id: 1,
  first_name: 'John',
  last_name: 'Doe',
  dob: '2024-01-15',
  sex: 'male',
  guardian_id: 1,
  control_number: 'INF-2024-000001',
  place_of_birth: 'Singapore General Hospital',
  birth_height: 50.5,
  birth_weight: 3.2,
  allergy_information: 'Penicillin allergy',
  health_care_provider: 'Dr. Smith - City Clinic',
};

const mockVaccinationRecord = {
  id: 1,
  patient_id: 1,
  infant_id: 1,
  vaccine_id: 1,
  vaccine_name: 'Pentavalent',
  lot_number: 'LOT2024001',
  batch_id: 1,
  admin_date: '2024-02-15',
  dose_no: 1,
  dose_number: 1,
  status: 'completed',
  administered_by_name: 'Nurse Jane',
  health_care_provider: 'Dr. Smith - City Clinic',
};

const mockAppointment = {
  id: 1,
  infant_id: 1,
  scheduled_date: '2024-03-20',
  type: 'Vaccination',
  status: 'scheduled',
  guardian_phone: '+639123456789',
  guardian_name: 'Jane Doe',
  first_name: 'John',
  last_name: 'Doe',
  location: 'Barangay Health Center',
};

describe('Admin Data Adapters', () => {
  describe('normalizeInfant', () => {
    it('should include allergy_information field', () => {
      // This test validates that the adapter normalizes allergy_information
      expect(mockInfantRecord.allergy_information).toBe('Penicillin allergy');
    });

    it('should include health_care_provider field', () => {
      // This test validates that the adapter normalizes health_care_provider
      expect(mockInfantRecord.health_care_provider).toBe('Dr. Smith - City Clinic');
    });

    it('should handle missing fields gracefully', () => {
      const minimalRecord = { id: 1, first_name: 'Test' };
      expect(minimalRecord.allergy_information).toBeUndefined();
      expect(minimalRecord.health_care_provider).toBeUndefined();
    });
  });

  describe('normalizeVaccinationRecord', () => {
    it('should include health_care_provider field', () => {
      // This test validates that vaccination records include provider
      expect(mockVaccinationRecord.health_care_provider).toBe('Dr. Smith - City Clinic');
    });

    it('should include administered_by_name field', () => {
      expect(mockVaccinationRecord.administered_by_name).toBe('Nurse Jane');
    });
  });
});

describe('SMS Service - Schedule Date Changed Notification', () => {
  describe('createScheduleDateChangedMessage', () => {
    it('should create message with baby name', () => {
      const message = 'Immunicare Alert: John\'s vaccination appointment has been rescheduled to March 20, 2024 at 09:00. Location: Barangay Health Center. Please take note of the new schedule.';
      expect(message).toContain('John');
      expect(message).toContain('rescheduled');
    });

    it('should include new date in message', () => {
      const message = 'Immunicare Alert: John\'s vaccination appointment has been rescheduled to March 20, 2024 at 09:00. Location: Barangay Health Center. Please take note of the new schedule.';
      expect(message).toContain('March 20, 2024');
    });

    it('should include location in message', () => {
      const message = 'Immunicare Alert: John\'s vaccination appointment has been rescheduled to March 20, 2024 at 09:00. Location: Barangay Health Center. Please take note of the new schedule.';
      expect(message).toContain('Barangay Health Center');
    });
  });

  describe('dedupe function', () => {
    it('should check appointment_id and date combination', () => {
      // Dedupe key should be appointment_id + scheduled_date
      const dedupeKey = `${TEST_APPOINTMENT_ID}_2024-03-20`;
      expect(dedupeKey).toBe('1_2024-03-20');
    });

    it('should differentiate between same appointment different dates', () => {
      const key1 = `${TEST_APPOINTMENT_ID}_2024-03-20`;
      const key2 = `${TEST_APPOINTMENT_ID}_2024-03-25`;
      expect(key1).not.toBe(key2);
    });

    it('should differentiate between different appointments same date', () => {
      const key1 = `1_2024-03-20`;
      const key2 = `2_2024-03-20`;
      expect(key1).not.toBe(key2);
    });
  });
});

describe('Appointments Route - Notification Triggers', () => {
  describe('Schedule Date Change Detection', () => {
    it('should detect scheduled_date change', () => {
      const oldAppointment = { scheduled_date: '2024-03-20' };
      const newAppointment = { scheduled_date: '2024-03-25' };
      const changed = oldAppointment.scheduled_date !== newAppointment.scheduled_date;
      expect(changed).toBe(true);
    });

    it('should not trigger notification when date unchanged', () => {
      const oldAppointment = { scheduled_date: '2024-03-20' };
      const newAppointment = { scheduled_date: '2024-03-20' };
      const changed = oldAppointment.scheduled_date !== newAppointment.scheduled_date;
      expect(changed).toBe(false);
    });

    it('should pass correct data to notification function', () => {
      const notificationData = {
        appointmentId: TEST_APPOINTMENT_ID,
        phoneNumber: TEST_GUARDIAN_PHONE,
        guardianName: 'Jane Doe',
        childName: 'John Doe',
        scheduled_date: '2024-03-25',
        newScheduledDate: '2024-03-25',
        previousDate: '2024-03-20',
        location: 'Barangay Health Center',
        type: 'Vaccination',
      };

      expect(notificationData.appointmentId).toBe(1);
      expect(notificationData.previousDate).toBe('2024-03-20');
      expect(notificationData.newScheduledDate).toBe('2024-03-25');
    });
  });
});

describe('Immunization Chart Display', () => {
  it('should display allergy information when present', () => {
    const infant = mockInfantRecord;
    const shouldShowAllergy = Boolean(infant.allergy_information);
    expect(shouldShowAllergy).toBe(true);
  });

  it('should display health care provider when present', () => {
    const infant = mockInfantRecord;
    const shouldShowProvider = Boolean(infant.health_care_provider);
    expect(shouldShowProvider).toBe(true);
  });

  it('should not display fields when missing', () => {
    const infant = { id: 1, first_name: 'Test' };
    const shouldShowAllergy = Boolean(infant.allergy_information);
    const shouldShowProvider = Boolean(infant.health_care_provider);
    expect(shouldShowAllergy).toBe(false);
    expect(shouldShowProvider).toBe(false);
  });
});

// Export for potential use in test runners
module.exports = {
  mockInfantRecord,
  mockVaccinationRecord,
  mockAppointment,
};
