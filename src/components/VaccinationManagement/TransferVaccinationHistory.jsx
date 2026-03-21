import React, { useState } from 'react';
import apiClient from '../../utils/api';
import { APPROVED_VACCINE_NAMES } from '../../constants/approvedVaccines';
import {
  buildTransferCaseVaccinesPayload,
  createTransferVaccineEntry,
  validateTransferHistoryEntries,
} from '../../utils/transferCasePayloads';

const TransferVaccinationHistory = ({ infantId, infantName, onClose, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [sourceFacility, setSourceFacility] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const vaccineList = APPROVED_VACCINE_NAMES.map((name) => ({
    id: name,
    name,
  }));

  // Initial vaccine entry
  const [vaccineEntries, setVaccineEntries] = useState([
    createTransferVaccineEntry(1),
  ]);

  const addVaccineEntry = () => {
    const newId = Math.max(...vaccineEntries.map((v) => v.id), 0) + 1;
    setVaccineEntries([...vaccineEntries, createTransferVaccineEntry(newId, sourceFacility)]);
  };

  const removeVaccineEntry = (id) => {
    if (vaccineEntries.length > 1) {
      setVaccineEntries(vaccineEntries.filter((v) => v.id !== id));
    }
  };

  const updateVaccineEntry = (id, field, value) => {
    setVaccineEntries(
      vaccineEntries.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  // Auto-calculate dose number based on previous entries for the same vaccine
  const getNextDoseNumber = (vaccineName) => {
    const sameVaccineEntries = vaccineEntries.filter(
      (v) => v.vaccineName === vaccineName
    );
    return sameVaccineEntries.length + 1;
  };

  const handleVaccineChange = (id, value) => {
    const entry = vaccineEntries.find((v) => v.id === id);
    if (entry) {
      const nextDose = getNextDoseNumber(value);
      updateVaccineEntry(id, 'vaccineName', value);
      updateVaccineEntry(id, 'doseNumber', nextDose);
    }
  };

  const validateVaccines = async () => {
    setError('');
    setSuccessMessage('');

    if (!String(sourceFacility || '').trim()) {
      setError('Health facility name is required before submitting a transfer case.');
      return false;
    }

    const validationResult = validateTransferHistoryEntries(vaccineEntries);
    if (!validationResult.isValid) {
      setError(validationResult.errors[0]);
      return false;
    }

    return true;
  };

  const submitVaccines = async () => {
    try {
      const isLocallyValid = await validateVaccines();
      if (!isLocallyValid) {
        return;
      }

      setSubmitting(true);
      setError('');
      setSuccessMessage('');

      const submittedVaccines = buildTransferCaseVaccinesPayload(
        vaccineEntries,
        sourceFacility,
      );

      const response = await apiClient.createTransferInCase({
        infant_id: infantId,
        source_facility: sourceFacility,
        submitted_vaccines: submittedVaccines,
        vaccination_card_url: null,
        remarks: null,
      });

      if (response.success) {
        const transferMessage =
          response.message ||
          'Transfer vaccination history submitted successfully for admin review.';

        setSuccessMessage(transferMessage);

        if (onSuccess) {
          onSuccess(response.data);
        }

        setVaccineEntries([
          createTransferVaccineEntry(1),
        ]);
        setSourceFacility('');
      } else {
        setError(response.error || 'Transfer case submission failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to submit transfer case');
    } finally {
      setSubmitting(false);
    }
  };

  const saveAsDraft = async () => {
    setSubmitting(true);
    setError('');

    try {
      // Save as draft - store in localStorage for now
      const draft = {
        infantId,
        sourceFacility,
        vaccines: vaccineEntries,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(`vaccination_draft_${infantId}`, JSON.stringify(draft));
      alert('Draft saved successfully');
    } catch (err) {
      setError('Failed to save draft');
    } finally {
      setSubmitting(false);
    }
  };

  const loadDraft = () => {
    const draftData = localStorage.getItem(`vaccination_draft_${infantId}`);
    if (draftData) {
      const draft = JSON.parse(draftData);
      setSourceFacility(draft.sourceFacility || '');
      setVaccineEntries(draft.vaccines || []);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Transfer Vaccination History
            </h2>
            <p className="text-sm text-gray-600">
              For: {infantName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              {successMessage}
            </div>
          )}

          {/* Source Facility */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Health Facility Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={sourceFacility}
              onChange={(e) => setSourceFacility(e.target.value)}
              placeholder="Enter the name of the previous health center"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Vaccine Entries */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Vaccine Records
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadDraft}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  Load Draft
                </button>
                <button
                  type="button"
                  onClick={addVaccineEntry}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  + Add Vaccine
                </button>
              </div>
            </div>

            {vaccineEntries.map((entry, index) => (
              <div
                key={entry.id}
                className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    Vaccine #{index + 1}
                  </span>
                  {vaccineEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVaccineEntry(entry.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Vaccine Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vaccine Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={entry.vaccineName}
                      onChange={(e) => handleVaccineChange(entry.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select vaccine</option>
                      {vaccineList.map((v) => (
                        <option key={v.id} value={v.name}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dose Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dose Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={entry.doseNumber}
                      onChange={(e) =>
                        updateVaccineEntry(entry.id, 'doseNumber', parseInt(e.target.value) || 1)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Date Administered */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date Administered <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={entry.dateAdministered}
                      onChange={(e) =>
                        updateVaccineEntry(entry.id, 'dateAdministered', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Facility Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Health Facility
                    </label>
                    <input
                      type="text"
                      value={entry.facilityName}
                      onChange={(e) =>
                        updateVaccineEntry(entry.id, 'facilityName', e.target.value)
                      }
                      placeholder="Where vaccine was given"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Batch Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Batch/Lot Number
                    </label>
                    <input
                      type="text"
                      value={entry.batchNumber}
                      onChange={(e) =>
                        updateVaccineEntry(entry.id, 'batchNumber', e.target.value)
                      }
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Enter each previously administered dose with the exact administered date.
            Submission now creates a transfer-in case for admin review instead of importing
            vaccines directly into the official record.
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={saveAsDraft}
            disabled={submitting}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Save as Draft
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={submitVaccines}
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Transfer Case'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferVaccinationHistory;
