import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Modal,
  Card,
  LoadingSpinner,
  EmptyState,
  SkeletonCard,
} from "./UI";
import apiClient from "../utils/api";

export default function DocumentTemplates({ onRefresh }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPaperTemplates();
      setTemplates(response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTemplate = async (templateId, isActive) => {
    try {
      await apiClient.updatePaperTemplate(templateId, { is_active: !isActive });
      fetchTemplates();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleViewDetails = (template) => {
    setSelectedTemplate(template);
    setShowDetailsModal(true);
  };

  const filteredTemplates = templates.filter(
    (template) =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.template_type.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading && templates.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
            Document Templates
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage and configure document templates for different purposes
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex justify-between items-center">
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            className="p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {template.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {template.template_type}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleToggleTemplate(template.id, template.is_active)
                  }
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    template.is_active
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                  }`}
                >
                  {template.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400">
                  Description
                </label>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {template.description || "No description provided"}
                </p>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400">
                    Fields
                  </label>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {template.fields?.length || 0} configured
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400">
                    Status
                  </label>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      template.is_active
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    }`}
                  >
                    {template.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-4 justify-center">
                <Button size="sm" onClick={() => handleViewDetails(template)}>
                  View Details
                </Button>
                <Button size="sm" variant="secondary">
                  Edit Template
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <EmptyState
          title={searchQuery ? "No matching templates" : "No templates found"}
          description={
            searchQuery
              ? `We couldn't find any templates matching "${searchQuery}".`
              : "There are no document templates configured in the system."
          }
          icon="📄"
          actionLabel={searchQuery ? "Clear Search" : null}
          onAction={searchQuery ? () => setSearchQuery("") : null}
          className="border-none shadow-none py-12"
        />
      )}

      {/* Template Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={selectedTemplate?.name}
        size="lg"
      >
        {selectedTemplate && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Template Type
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {selectedTemplate.template_type}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      selectedTemplate.is_active
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    }`}
                  >
                    {selectedTemplate.is_active ? "Active" : "Inactive"}
                  </span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {selectedTemplate.description || "No description provided"}
              </p>
            </div>

            {/* Fields Configuration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fields Configuration ({selectedTemplate.fields?.length || 0}{" "}
                fields)
              </label>
              <div className="space-y-2">
                {selectedTemplate.fields?.length > 0 ? (
                  selectedTemplate.fields.map((field, index) => (
                    <Card key={index} className="p-3">
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Field:</span>
                          <span className="ml-1 font-medium">
                            {field.field}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Label:</span>
                          <span className="ml-1 font-medium">
                            {field.label}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Source:</span>
                          <span className="ml-1 font-medium">
                            {field.source}
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              field.required
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                            }`}
                          >
                            {field.required ? "Required" : "Optional"}
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No fields configured
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-4">
              <Button
                variant="cancel"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
              <Button>Edit Template</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
