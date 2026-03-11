import React, { useState, useEffect } from "react";
import { Users, Baby, ChevronRight, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../utils/api";
import { triggerGuardianAddChildModal } from "../QuickActionFAB";

/**
 * ChildrenSummaryCard Component
 * Displays a summary of the guardian's registered children
 *
 * @param {Object} props
 * @param {string} props.guardianId - Guardian ID to fetch children
 * @param {boolean} props.loading - Loading state from parent
 */
const ChildrenSummaryCard = ({ guardianId, loading: parentLoading = false }) => {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  const normalizeChild = (child) => {
    if (!child || typeof child !== "object") {
      return {
        id: null,
        name: "",
        dateOfBirth: null,
        controlNumber: null,
      };
    }

    const firstName = child.first_name || child.firstName || "";
    const lastName = child.last_name || child.lastName || "";
    const fallbackName = [firstName, lastName].filter(Boolean).join(" ").trim();

    return {
      ...child,
      id: child.id,
      name: child.name || fallbackName || "",
      dateOfBirth: child.dateOfBirth || child.dob || null,
      controlNumber: child.controlNumber || child.control_number || null,
    };
  };

  useEffect(() => {
    const fetchChildren = async () => {
      if (!guardianId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiClient.getInfantsByGuardian(guardianId);
        const childrenData = Array.isArray(response)
          ? response
          : response?.data || [];
        setChildren(childrenData.map(normalizeChild).slice(0, 3)); // Show max 3 children
      } catch (err) {
        console.error("Error fetching children:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchChildren();
  }, [guardianId]);

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return "Age unknown";
    const dob = new Date(dateOfBirth);
    const today = new Date();
    const months = Math.floor((today - dob) / (1000 * 60 * 60 * 24 * 30.44));

    if (months < 1) return "Newborn";
    if (months < 12) return `${months} month${months !== 1 ? "s" : ""}`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years} year${years !== 1 ? "s" : ""}`;
    return `${years}y ${remainingMonths}m`;
  };

  const isLoading = loading || parentLoading;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-xl flex items-center justify-center">
              <Baby className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                My Children
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Quick overview of registered children
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/guardian/children")}
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 min-h-[44px] px-3 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl animate-pulse"
              >
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-32" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : children.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              No Children Registered
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Add your first child to get started
            </p>
            <button
              onClick={() => {
                navigate('/guardian/children');
                setTimeout(() => {
                  triggerGuardianAddChildModal();
                }, 0);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              Add Child
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((child) => (
              <div
                key={child.id}
                onClick={() => navigate(`/guardian/children/${child.id}`)}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group"
              >
                {/* Avatar */}
                <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                  {child.name?.charAt(0) || "?"}
                </div>

                {/* Child Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                    {child.name || "Unnamed Child"}
                  </h4>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span>{calculateAge(child.dateOfBirth)}</span>
                    {child.controlNumber && (
                      <>
                        <span>•</span>
                        <span className="text-xs">ID: {child.controlNumber}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </div>
            ))}

            {/* Show more indicator */}
            {children.length >= 3 && (
              <button
                onClick={() => navigate("/guardian/children")}
                className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium text-center hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors"
              >
                View all children
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChildrenSummaryCard;
