import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Modal,
  Card,
  EmptyState,
  SkeletonTable,
  Alert,
} from "./UI";
import apiClient from "../utils/api";

export default function PaperConfiguration({ onRefresh }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    template_type: "VACCINE_SCHEDULE",
    fields: [],
  });

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

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: "",
      description: "",
      template_type: "VACCINE_SCHEDULE",
      fields: [],
    });
    setShowModal(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name || "",
      description: template.description || "",
      template_type: template.template_type || "VACCINE_SCHEDULE",
      fields: template.fields || [],
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await apiClient.updatePaperTemplate(editingTemplate.id, templateForm);
      } else {
        await apiClient.createPaperTemplate(templateForm);
      }
      setShowModal(false);
      fetchTemplates();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (window.confirm("Are you sure you want to delete this template?")) {
      try {
        await apiClient.deletePaperTemplate(id);
        fetchTemplates();
        if (onRefresh) onRefresh();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const addField = () => {
    const newField = {
      field: "",
      label: "",
      source: "",
      required: false,
    };
    setTemplateForm((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
  };

  const updateField = (index, fieldData) => {
    const newFields = [...templateForm.fields];
    newFields[index] = { ...newFields[index], ...fieldData };
    setTemplateForm((prev) => ({
      ...prev,
      fields: newFields,
    }));
  };

  const removeField = (index) => {
    const newFields = templateForm.fields.filter((_, i) => i !== index);
    setTemplateForm((prev) => ({
      ...prev,
      fields: newFields,
    }));
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
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
        </div>
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
            Paper Configuration
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure paper templates and field mappings for digitization
          </p>
        </div>
        <Button onClick={handleAddTemplate}>Add New Template</Button>
      </div>

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {/* Search */}
      <div className="flex justify-between items-center">
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Templates List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Template Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Fields
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTemplates.map((template) => (
                <tr
                  key={template.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {template.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {template.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full">
                      {template.template_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {template.fields?.length || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        template.is_active
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {template.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTemplates.length === 0 && (
          <EmptyState
            title={
              searchQuery ? "No matching templates" : "No templates configured"
            }
            description={
              searchQuery
                ? `We couldn't find any templates matching "${searchQuery}".`
                : "Start by creating your first digital paper template to begin digitizing your records."
            }
            icon="📄"
            actionLabel={searchQuery ? "Clear Search" : "Add New Template"}
            onAction={
              searchQuery ? () => setSearchQuery("") : handleAddTemplate
            }
            className="border-none shadow-none"
          />
        )}
      </div>

      {/* Template Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTemplate ? "Edit Template" : "Add New Template"}
        size="lg"
        footer={
          <div className="form-actions-standardized">
            <Button
              variant="cancel"
              actionRole="cancel"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" actionRole="primary" form="templateForm">
              {editingTemplate ? "Update Template" : "Add Template"}
            </Button>
          </div>
        }
      >
        <form id="templateForm" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Template Name"
            name="name"
            value={templateForm.name}
            onChange={(e) =>
              setTemplateForm({ ...templateForm, name: e.target.value })
            }
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template Type
            </label>
            <select
              value={templateForm.template_type}
              onChange={(e) =>
                setTemplateForm({
                  ...templateForm,
                  template_type: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              required
            >
              <option value="VACCINE_SCHEDULE">Vaccine Schedule</option>
              <option value="IMMUNIZATION_RECORD">Immunization Record</option>
              <option value="INVENTORY_LOGBOOK">Inventory Logbook</option>
              <option value="GROWTH_CHART">Growth Chart</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={templateForm.description}
              onChange={(e) =>
                setTemplateForm({
                  ...templateForm,
                  description: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              rows={3}
              placeholder="Describe the purpose and usage of this template..."
            />
          </div>

          {/* Fields Configuration */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Fields Configuration
              </label>
              <Button type="button" onClick={addField} size="sm">
                Add Field
              </Button>
            </div>

            <div className="space-y-3">
              {templateForm.fields.map((field, index) => (
                <Card key={index} className="p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <Input
                      label="Field Name"
                      value={field.field}
                      onChange={(e) =>
                        updateField(index, { field: e.target.value })
                      }
                      placeholder="e.g., infant_name"
                    />
                    <Input
                      label="Display Label"
                      value={field.label}
                      onChange={(e) =>
                        updateField(index, { label: e.target.value })
                      }
                      placeholder="e.g., Child Name"
                    />
                    <Input
                      label="Data Source"
                      value={field.source}
                      onChange={(e) =>
                        updateField(index, { source: e.target.value })
                      }
                      placeholder="e.g., infants.full_name"
                    />
                    <div className="flex items-end">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={field.required || false}
                          onChange={(e) =>
                            updateField(index, { required: e.target.checked })
                          }
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Required
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeField(index)}
                        className="ml-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
