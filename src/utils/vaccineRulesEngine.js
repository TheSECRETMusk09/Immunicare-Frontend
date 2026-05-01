/**
 * Vaccine Rules Engine
 * Handles vaccination schedule logic, dose calculations, and status determinations
 */

import apiClient from './api';

// Official vaccination schedule (will be fetched from backend)
const VACCINE_SCHEDULE = {
  // Structure: { vaccineName: { doses: [{ number, ageInMonths, vaccines: [...] }] } }
};

// Cache for vaccination schedule
let scheduleCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const LEGACY_TRIAGE_STATUS_MAP = Object.freeze({
  needs_verification: "needs_verification",
  ready_for_scheduling: "ready_for_scheduling",
  priority_follow_up: "priority_follow_up",
  not_yet_due: "not_yet_due",
});

const normalizeDate = (value) => {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeScheduleShape = (schedule = {}) => {
  return Object.entries(schedule || {}).reduce((accumulator, [scheduleKey, value]) => {
    if (Array.isArray(value)) {
      const displayName = String(scheduleKey || "").trim();
      accumulator[scheduleKey] = {
        name: displayName,
        doses: value
          .map((dose) => ({
            number: Number(dose?.number ?? dose?.dose ?? dose?.dose_number),
            ageInMonths: Number(dose?.ageInMonths ?? dose?.minAgeMonths ?? 0),
            maxAgeMonths:
              dose?.maxAgeMonths !== undefined ? Number(dose.maxAgeMonths) : null,
            intervalDays:
              dose?.intervalDays !== undefined ? Number(dose.intervalDays) : null,
          }))
          .filter((dose) => Number.isFinite(dose.number)),
      };
      return accumulator;
    }

    if (value && Array.isArray(value.doses)) {
      accumulator[scheduleKey] = {
        ...value,
        name: value.name || scheduleKey,
        doses: value.doses
          .map((dose) => ({
            ...dose,
            number: Number(dose?.number ?? dose?.dose ?? dose?.dose_number),
            ageInMonths: Number(dose?.ageInMonths ?? dose?.minAgeMonths ?? 0),
          }))
          .filter((dose) => Number.isFinite(dose.number)),
      };
    }

    return accumulator;
  }, {});
};

const buildCompletedDoseSummary = (vaccinationHistory = []) => {
  const completed = {};
  const today = new Date();

  vaccinationHistory.forEach((record) => {
    const vaccineName = String(
      record?.vaccine?.name || record?.vaccine || record?.vaccine_name || record?.vaccine_id || "",
    ).trim();
    const doseNumber = Number(
      record?.dose_number ?? record?.dose_no ?? record?.dose ?? 1,
    );
    const administeredDate = normalizeDate(
      record?.date_received ?? record?.dateReceived ?? record?.administered_at,
    );

    if (!vaccineName || !Number.isFinite(doseNumber) || doseNumber < 1) {
      return;
    }

    if (administeredDate && administeredDate > today) {
      return;
    }

    if (!completed[vaccineName]) {
      completed[vaccineName] = {
        count: 0,
        doses: [],
      };
    }

    if (!completed[vaccineName].doses.includes(doseNumber)) {
      completed[vaccineName].count += 1;
      completed[vaccineName].doses.push(doseNumber);
    }
  });

  return completed;
};

const toCompletedDoseLookup = (completedDoses = {}, schedule = {}) => {
  const normalizedSchedule = normalizeScheduleShape(schedule);
  const counts = {};

  Object.values(normalizedSchedule).forEach((vaccine) => {
    counts[vaccine.name] = 0;
  });

  Object.entries(completedDoses || {}).forEach(([vaccineName, value]) => {
    if (typeof value === "number") {
      counts[vaccineName] = value;
      return;
    }

    const doses = Array.isArray(value?.doses) ? value.doses : [];
    counts[vaccineName] = doses.length;
  });

  return counts;
};

/**
 * Fetch official vaccination schedule from backend
 * @returns {Promise<Object>} Vaccination schedule data
 */
export const fetchVaccinationSchedule = async () => {
  // Check cache first
  const now = Date.now();
  if (scheduleCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return scheduleCache;
  }

  try {
    const response =
      typeof apiClient.getVaccinationSchedule === "function"
        ? await apiClient.getVaccinationSchedule()
        : typeof apiClient.getVaccinationSchedules === "function"
          ? await apiClient.getVaccinationSchedules()
          : getMockVaccinationSchedule();
    scheduleCache = normalizeScheduleShape(response);
    cacheTimestamp = now;
    return scheduleCache;
  } catch (error) {
    console.error('Error fetching vaccination schedule:', error);
    // Return mock data for development
    return normalizeScheduleShape(getMockVaccinationSchedule());
  }
};

export const getVaccinationSchedule = async () => {
  const normalizedSchedule = await fetchVaccinationSchedule();

  return Object.values(normalizedSchedule).reduce((accumulator, vaccine) => {
    accumulator[vaccine.name] = vaccine.doses.map((dose) => ({
      dose: dose.number,
      minAgeMonths: dose.ageInMonths,
      maxAgeMonths: dose.maxAgeMonths,
      intervalDays: dose.intervalDays,
    }));
    return accumulator;
  }, {});
};

/**
 * Get mock vaccination schedule for development
 * @returns {Object} Mock vaccination schedule
 */
const getMockVaccinationSchedule = () => ({
  hepatitis_b: {
    name: 'Hepatitis B',
    doses: [
      { number: 1, ageInMonths: 0, vaccine: 'hep_b' },
      { number: 2, ageInMonths: 1, vaccine: 'hep_b' },
      { number: 3, ageInMonths: 6, vaccine: 'hep_b' }
    ]
  },
  bcg: {
    name: 'BCG',
    doses: [
      { number: 1, ageInMonths: 0, vaccine: 'bcg' }
    ]
  },
  pentavalent: {
    name: 'Pentavalent',
    doses: [
      { number: 1, ageInMonths: 1.5, vaccine: 'penta' },
      { number: 2, ageInMonths: 2.5, vaccine: 'penta' },
      { number: 3, ageInMonths: 3.5, vaccine: 'penta' }
    ]
  },
  opv: {
    name: 'Oral Polio Vaccine',
    doses: [
      { number: 1, ageInMonths: 1.5, vaccine: 'opv' },
      { number: 2, ageInMonths: 2.5, vaccine: 'opv' },
      { number: 3, ageInMonths: 3.5, vaccine: 'opv' }
    ]
  },
  ipv: {
    name: 'Inactivated Polio Vaccine',
    doses: [
      { number: 1, ageInMonths: 1.5, vaccine: 'ipv' },
      { number: 2, ageInMonths: 3.5, vaccine: 'ipv' }
    ]
  },
  pcv: {
    name: 'Pneumococcal Conjugate Vaccine',
    doses: [
      { number: 1, ageInMonths: 1.5, vaccine: 'pcv' },
      { number: 2, ageInMonths: 2.5, vaccine: 'pcv' },
      { number: 3, ageInMonths: 3.5, vaccine: 'pcv' }
    ]
  },
  measles: {
    name: 'Measles Vaccine',
    doses: [
      { number: 1, ageInMonths: 9, vaccine: 'mcv' },
      { number: 2, ageInMonths: 15, vaccine: 'mcv' }
    ]
  }
});

/**
 * Calculate completed doses from vaccination history
 * @param {Array} vaccinationHistory - Array of vaccination records
 * @returns {Object} Completed doses by vaccine
 */
export const calculateCompletedDoses = (vaccinationHistory = [], schedule = null) => {
  if (schedule) {
    const normalizedSchedule = normalizeScheduleShape(schedule);
    const counts = {};
    const today = new Date();

    Object.values(normalizedSchedule).forEach((vaccine) => {
      counts[vaccine.name] = 0;
    });

    vaccinationHistory.forEach((record) => {
      const vaccineName = String(
        record?.vaccine?.name || record?.vaccine || record?.vaccine_name || "",
      ).trim();
      const doseNumber = Number(
        record?.dose_number ?? record?.dose_no ?? record?.dose ?? 1,
      );
      const administeredDate = normalizeDate(
        record?.date_received ?? record?.dateReceived ?? record?.administered_at,
      );
      const vaccineEntry = Object.values(normalizedSchedule).find(
        (vaccine) => vaccine.name === vaccineName,
      );

      if (!vaccineEntry || !Number.isFinite(doseNumber)) {
        return;
      }

      if (administeredDate && administeredDate > today) {
        return;
      }

      const doseExists = vaccineEntry.doses.some((dose) => dose.number === doseNumber);
      if (!doseExists) {
        return;
      }

      counts[vaccineName] += 1;
    });

    return counts;
  }

  return buildCompletedDoseSummary(vaccinationHistory);
};

/**
 * Detect missing doses based on vaccination history and schedule
 * @param {Object} completedDoses - Completed doses by vaccine
 * @param {Object} schedule - Vaccination schedule
 * @returns {Object} Missing doses by vaccine
 */
export const detectMissingDoses = (completedDosesOrHistory = {}, schedule = {}) => {
  const normalizedSchedule = normalizeScheduleShape(schedule);
  const completedDoses = Array.isArray(completedDosesOrHistory)
    ? buildCompletedDoseSummary(completedDosesOrHistory)
    : completedDosesOrHistory;
  const missing = {};

  Object.keys(normalizedSchedule).forEach(vaccineKey => {
    const vaccine = normalizedSchedule[vaccineKey];
    const completedForVaccine = completedDoses[vaccine.name] || { count: 0, doses: [] };
    const completedDoseNumbers = new Set(completedForVaccine.doses);

    const missingDoses = vaccine.doses.filter(dose =>
      !completedDoseNumbers.has(dose.number)
    );

    if (missingDoses.length > 0) {
      missing[vaccine.name] = {
        vaccine: vaccineKey,
        missingDoses: missingDoses.map(dose => dose.number),
        nextDose: missingDoses[0] // First missing dose
      };
    }
  });

  return missing;
};

/**
 * Calculate next valid dose based on child's age and vaccination history
 * @param {Object} child - Child data including date of birth
 * @param {Array} vaccinationHistory - Array of vaccination records
 * @param {Object} schedule - Vaccination schedule
 * @returns {Object} Next dose information
 */
export const calculateNextValidDose = (
  childOrHistory,
  vaccinationHistoryOrSchedule = [],
  scheduleOrBirthDate = {},
  explicitAgeInMonths,
) => {
  let child = childOrHistory;
  let vaccinationHistory = vaccinationHistoryOrSchedule;
  let schedule = scheduleOrBirthDate;
  let ageInMonths = Number(explicitAgeInMonths);

  if (Array.isArray(childOrHistory)) {
    vaccinationHistory = childOrHistory;
    schedule = vaccinationHistoryOrSchedule;
    const birthDate = normalizeDate(scheduleOrBirthDate);
    child = birthDate ? { dob: birthDate.toISOString() } : null;
  }

  if (!child || !child.dob) {
    return null;
  }

  if (!Number.isFinite(ageInMonths)) {
    const birthDate = new Date(child.dob);
    const today = new Date();
    ageInMonths = (today - birthDate) / (1000 * 60 * 60 * 24 * 30.44);
  }

  const normalizedSchedule = normalizeScheduleShape(schedule);

  const completedDoses = calculateCompletedDoses(vaccinationHistory);
  const missingDoses = detectMissingDoses(completedDoses, normalizedSchedule);

  let nextDoseInfo = null;
  let minAgeDiff = Infinity;

  // Find the earliest age-appropriate missing dose
  Object.keys(missingDoses).forEach(vaccineName => {
    const missing = missingDoses[vaccineName];
    const vaccineSchedule = normalizedSchedule[missing.vaccine];

    missing.missingDoses.forEach(doseNumber => {
      const doseInfo = vaccineSchedule.doses.find(d => d.number === doseNumber);
      if (doseInfo && doseInfo.ageInMonths <= ageInMonths) {
        const ageDiff = ageInMonths - doseInfo.ageInMonths;
        if (ageDiff < minAgeDiff) {
          minAgeDiff = ageDiff;
            nextDoseInfo = {
              vaccine: vaccineName,
              vaccineKey: missing.vaccine,
              doseNumber: doseNumber,
              dose_number: doseNumber,
              ageInMonths: doseInfo.ageInMonths,
              daysOverdue: ageDiff * 30.44, // Convert to days
              isOverdue: ageDiff > 0
            };
          }
      }
    });
  });

  // If no age-appropriate dose found, find the next upcoming dose
  if (!nextDoseInfo) {
    Object.keys(normalizedSchedule).forEach(vaccineKey => {
      const vaccine = normalizedSchedule[vaccineKey];
      const completedForVaccine = completedDoses[vaccine.name] || { count: 0, doses: [] };
      const completedDoseNumbers = new Set(completedForVaccine.doses);

      vaccine.doses.forEach(dose => {
        if (!completedDoseNumbers.has(dose.number) && dose.ageInMonths > ageInMonths) {
          const ageDiff = dose.ageInMonths - ageInMonths;
          if (ageDiff < minAgeDiff) {
            minAgeDiff = ageDiff;
            nextDoseInfo = {
              vaccine: vaccine.name,
              vaccineKey: vaccineKey,
              doseNumber: dose.number,
              dose_number: dose.number,
              ageInMonths: dose.ageInMonths,
              daysUntil: ageDiff * 30.44, // Convert to days
              isOverdue: false
            };
          }
        }
      });
    });
  }

  return nextDoseInfo;
};

/**
 * Classify vaccine status based on age and administration
 * @param {Object} doseInfo - Dose information from schedule
 * @param {number} ageInMonths - Child's age in months
 * @param {boolean} adminConfirmedReady - Whether admin has confirmed readiness
 * @param {boolean} vaccineAdministered - Whether vaccine has been administered
 * @returns {Object} Status information
 */
export const classifyVaccineStatus = (doseInfo, ageInMonths, adminConfirmedReady = false, vaccineAdministered = false) => {
  if (doseInfo instanceof Date && typeof ageInMonths === "string") {
    return ageInMonths;
  }

  if (vaccineAdministered) {
    return {
      status: 'completed',
      label: 'Completed',
      icon: 'Check',
      bgClass: 'bg-green-100 dark:bg-green-900/30',
      borderClass: 'border-green-300 dark:border-green-700',
      textClass: 'text-green-700 dark:text-green-400'
    };
  }

  if (ageInMonths < doseInfo.ageInMonths) {
    return {
      status: 'upcoming',
      label: 'Upcoming',
      icon: 'Clock',
      bgClass: 'bg-blue-100 dark:bg-blue-900/30',
      borderClass: 'border-blue-300 dark:border-blue-700',
      textClass: 'text-blue-700 dark:text-blue-400'
    };
  }

  if (!adminConfirmedReady) {
    return {
      status: 'pending_confirmation',
      label: 'Pending Confirmation',
      icon: 'Lock',
      bgClass: 'bg-amber-100 dark:bg-amber-900/30',
      borderClass: 'border-amber-300 dark:border-amber-700',
      textClass: 'text-amber-700 dark:text-amber-400'
    };
  }

  // Age eligible and admin confirmed ready
  const daysOverdue = (ageInMonths - doseInfo.ageInMonths) * 30.44;
  if (daysOverdue > 0) {
    return {
      status: 'overdue',
      label: 'Overdue',
      icon: 'AlertCircle',
      bgClass: 'bg-red-100 dark:bg-red-900/30',
      borderClass: 'border-red-300 dark:border-red-700',
      textClass: 'text-red-700 dark:text-red-400'
    };
  }

  // Determine if due soon (within 7 days)
  const daysUntil = (doseInfo.ageInMonths - ageInMonths) * 30.44;
  if (daysUntil >= 0 && daysUntil <= 7) {
    return {
      status: 'due_soon',
      label: 'Due Soon',
      icon: 'Clock',
      bgClass: 'bg-orange-100 dark:bg-orange-900/30',
      borderClass: 'border-orange-300 dark:border-orange-700',
      textClass: 'text-orange-700 dark:text-orange-400'
    };
  }

  return {
    status: 'ready',
    label: 'Ready to Receive',
    icon: 'Unlock',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
    borderClass: 'border-emerald-300 dark:border-emerald-700',
    textClass: 'text-emerald-700 dark:text-emerald-400'
  };
};

/**
 * Assign triage category for transfer-in cases
 * @param {Object} transferInData - Transfer-in submission data
 * @param {Object} schedule - Vaccination schedule
 * @returns {string} Triage category
 */
export const assignTriageCategory = (transferInData = {}, schedule = {}) => {
  if (typeof transferInData === "string") {
    return LEGACY_TRIAGE_STATUS_MAP[transferInData] || transferInData;
  }

  const { submittedVaccines = [], childDOB } = transferInData;

  if (!submittedVaccines || submittedVaccines.length === 0) {
    return 'needs_missing_information';
  }

  const birthDate = new Date(childDOB);
  const today = new Date();
  const ageInMonths = (today - birthDate) / (1000 * 60 * 60 * 24 * 30.44);
  const normalizedSchedule = normalizeScheduleShape(schedule);

  // Check for invalid dates
  const hasInvalidDates = submittedVaccines.some(vaccine =>
    vaccine.dateReceived &&
    (new Date(vaccine.dateReceived) < birthDate || new Date(vaccine.dateReceived) > today)
  );

  if (hasInvalidDates) {
    return 'needs_record_verification';
  }

  // Calculate what vaccines should have been given by this age
  const expectedVaccines = [];
  Object.keys(normalizedSchedule).forEach(vaccineKey => {
    const vaccine = normalizedSchedule[vaccineKey];
    vaccine.doses.forEach(dose => {
      if (dose.ageInMonths <= ageInMonths) {
        expectedVaccines.push({
          vaccine: vaccine.name,
          doseNumber: dose.number
        });
      }
    });
  });

  // Check if all expected vaccines are submitted
  const submittedSet = new Set(
    submittedVaccines.map(v => `${v.vaccine}-${v.doseNumber}`)
  );

  const expectedSet = new Set(
    expectedVaccines.map(v => `${v.vaccine}-${v.doseNumber}`)
  );

  const missingExpected = [...expectedSet].filter(item => !submittedSet.has(item));

  if (missingExpected.length > 0) {
    // Check if any missing vaccines are significantly overdue
    const hasOverdue = missingExpected.some(item => {
      const [vaccineName, doseNum] = item.split('-');
      const vaccine = Object.values(normalizedSchedule).find(v => v.name === vaccineName);
      if (!vaccine) return false;
      const dose = vaccine.doses.find(d => d.number === parseInt(doseNum));
      if (!dose) return false;
      const monthsOverdue = ageInMonths - dose.ageInMonths;
      return monthsOverdue > 1; // More than 1 month overdue
    });

    return hasOverdue ? 'overdue_priority_followup' : 'needs_record_verification';
  }

  // All expected vaccines submitted, check if next dose is ready
  const nextDose = calculateNextValidDose(
    { dob: childDOB },
    submittedVaccines,
    normalizedSchedule
  );

  if (!nextDose) {
    return 'not_yet_due';
  }

  if (nextDose.isOverdue) {
    return 'overdue_priority_followup';
  }

  return 'ready_for_scheduling';
};

export default {
  fetchVaccinationSchedule,
  getVaccinationSchedule,
  calculateCompletedDoses,
  detectMissingDoses,
  calculateNextValidDose,
  classifyVaccineStatus,
  assignTriageCategory
};
