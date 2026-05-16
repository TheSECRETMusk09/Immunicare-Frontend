import { useState, useCallback } from "react";

export const useForm = (initialValues = {}, validationRules = {}) => {
  const [fields, setValues] = useState(initialValues);
  const [errs, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setIsSubmitting] = useState(false);

  const setValue = useCallback(
    (name, value) => {
      setValues((prev) => ({ ...prev, [name]: value }));

      if (errs[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    },
    [errs]
  );

  const setFieldTouched = useCallback((name, isTouched = true) => {
    setTouched((prev) => ({ ...prev, [name]: isTouched }));
  }, []);

  const chkField = useCallback(
    (name, value) => {
      const rule = validationRules[name];
      if (!rule) return "";

      if (typeof rule === "function") {
        return rule(value, fields);
      }

      if (rule.required && (!value || value.toString().trim() === "")) {
        return rule.message || `${name} is required`;
      }

      if (rule.minLength && value && value.length < rule.minLength) {
        return (
          rule.message ||
          `${name} must be at least ${rule.minLength} characters`
        );
      }

      if (rule.maxLength && value && value.length > rule.maxLength) {
        return (
          rule.message || `${name} must not exceed ${rule.maxLength} characters`
        );
      }

      if (rule.pattern && value && !rule.pattern.test(value)) {
        return rule.message || `${name} format is invalid`;
      }

      if (rule.custom && typeof rule.custom === "function") {
        return rule.custom(value, fields);
      }

      return "";
    },
    [validationRules, fields]
  );

  const chkAll = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach((name) => {
      const error = chkField(name, fields[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [fields, validationRules, chkField]);

  const handleChange = useCallback(
    (e) => {
      const { name, value, type, checked } = e.target;
      const fieldValue = type === "checkbox" ? checked : value;
      setValue(name, fieldValue);
    },
    [setValue]
  );

  const handleBlur = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFieldTouched(name, true);

      const error = chkField(name, value);
      if (error) {
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [chkField, setFieldTouched]
  );

  const handleSubmit = useCallback(
    async (onSubmit) => {
      return async (e) => {
        if (e) {
          e.preventDefault();
        }

        setIsSubmitting(true);
        setTouched(
          Object.keys(fields).reduce(
            (acc, key) => ({ ...acc, [key]: true }),
            {}
          )
        );

        const isValid = chkAll();

        if (isValid && onSubmit) {
          try {
            await onSubmit(fields);
          } catch (error) {
            console.error("Form submission error:", error);
          }
        }

        setIsSubmitting(false);
        return isValid;
      };
    },
    [fields, chkAll]
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const setFieldError = useCallback((name, error) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  return {
    values: fields,
    errors: errs,
    touched,
    isSubmitting: submitting,
    setValue,
    setFieldTouched,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldError,
    validateAll: chkAll,
  };
};

export default useForm;
