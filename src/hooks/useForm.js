import { useState, useCallback } from "react";

export const useForm = (initialValues = {}, validationRules = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback(
    (name, value) => {
      setValues((prev) => ({ ...prev, [name]: value }));

      // Clear error when user starts typing
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    },
    [errors]
  );

  const setFieldTouched = useCallback((name, isTouched = true) => {
    setTouched((prev) => ({ ...prev, [name]: isTouched }));
  }, []);

  const validateField = useCallback(
    (name, value) => {
      const rule = validationRules[name];
      if (!rule) return "";

      if (typeof rule === "function") {
        return rule(value, values);
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
        return rule.custom(value, values);
      }

      return "";
    },
    [validationRules, values]
  );

  const validateAll = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach((name) => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validationRules, validateField]);

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

      // Validate field on blur
      const error = validateField(name, value);
      if (error) {
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [validateField, setFieldTouched]
  );

  const handleSubmit = useCallback(
    async (onSubmit) => {
      return async (e) => {
        if (e) {
          e.preventDefault();
        }

        setIsSubmitting(true);
        setTouched(
          Object.keys(values).reduce(
            (acc, key) => ({ ...acc, [key]: true }),
            {}
          )
        );

        const isValid = validateAll();

        if (isValid && onSubmit) {
          try {
            await onSubmit(values);
          } catch (error) {
            console.error("Form submission error:", error);
          }
        }

        setIsSubmitting(false);
        return isValid;
      };
    },
    [values, validateAll]
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
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setFieldTouched,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldError,
    validateAll,
  };
};

export default useForm;
