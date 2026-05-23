import apiClient from "./api";

const parseDateKey = (value) => {
  if (!value) return null;
  const key = typeof value === "string" ? value.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const todayDateOnly = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const splitVaccineLabel = (label, fallbackVaccineId, doseNumber) => {
  const safeLabel = typeof label === "string" ? label : "";
  const match = safeLabel.match(/^(.*?)\s*\(Dose\s*\d+\)\s*$/i);
  const vaccineName = (match ? match[1] : safeLabel).trim() ||
    (fallbackVaccineId ? `Vaccine ${fallbackVaccineId}` : "Vaccine");
  const doseLabel = doseNumber ? `Dose ${doseNumber}` : "";
  return { vaccineName, doseLabel };
};

export async function fetchEligibleVaccinesForAppointment(infantId, appointmentDate) {
  const numericInfantId = Number.parseInt(infantId, 10);
  const apptDate = parseDateKey(appointmentDate);
  if (!Number.isFinite(numericInfantId) || numericInfantId <= 0 || !apptDate) {
    return [];
  }

  let eligibilityResponse;
  try {
    eligibilityResponse = await apiClient.getEligibleVaccines(numericInfantId);
  } catch (_err) {
    return [];
  }

  if (!eligibilityResponse || typeof eligibilityResponse !== "object") return [];

  const eligibleVaccines = Array.isArray(eligibilityResponse.eligibleVaccines)
    ? eligibilityResponse.eligibleVaccines
    : [];
  const upcomingVaccines = Array.isArray(eligibilityResponse.upcomingVaccines)
    ? eligibilityResponse.upcomingVaccines
    : [];

  const today = todayDateOnly();
  const seen = new Set();
  const combined = [];

  [...eligibleVaccines, ...upcomingVaccines].forEach((entry) => {
    if (!entry) return;

    const vaccineId = Number(entry.vaccineId ?? entry.vaccine_id ?? 0) || null;
    const doseNumber = Number(
      entry.nextDoseNumber ?? entry.next_dose_number ?? entry.doseNumber ?? entry.dose_number ?? 1,
    ) || 1;
    const dueDateRaw = entry.dueDate ?? entry.due_date ?? entry.recommendedDate ?? entry.earliestDate ?? null;
    const dueDate = parseDateKey(dueDateRaw);

    if (dueDate && dueDate.getTime() > apptDate.getTime()) return;

    const dedupKey = `${vaccineId || entry.id || entry.vaccineName || entry.vaccine_name}-${doseNumber}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);

    const vaccineName = String(entry.vaccineName || entry.vaccine_name || "").trim() ||
      (vaccineId ? `Vaccine ${vaccineId}` : "Vaccine");
    const totalDoses = Number(entry.totalDoses ?? entry.total_doses ?? 0) || null;
    const doseLabel = totalDoses
      ? `Dose ${doseNumber}/${totalDoses}`
      : `Dose ${doseNumber}`;
    const label = `${vaccineName} (${doseLabel})`;

    let status = "Eligible";
    let tone = "green";
    if (dueDate && dueDate.getTime() < today.getTime()) {
      status = "Overdue";
      tone = "red";
    } else if (dueDate && dueDate.getTime() <= apptDate.getTime()) {
      status = "Due";
      tone = "amber";
    }

    combined.push({
      id: dedupKey,
      vaccineId,
      vaccineName,
      doseNumber,
      doseLabel,
      label,
      dueDate: dueDateRaw,
      status,
      tone,
    });
  });

  combined.sort((a, b) => {
    const aTime = parseDateKey(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = parseDateKey(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });

  return combined;
}
