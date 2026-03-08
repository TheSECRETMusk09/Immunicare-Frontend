import * as yup from "yup";

// Common validation patterns
const patterns = {
  phone: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  postalCode: /^[0-9]{4,6}$/,
  name: /^[a-zA-Z\s'-]+$/,
  alphanumeric: /^[a-zA-Z0-9\s-_]+$/,
};

// Error messages
const messages = {
  required: (field) => `${field} is required`,
  email: "Please enter a valid email address",
  phone: "Please enter a valid phone number",
  password:
    "Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character",
  passwordMatch: "Passwords do not match",
  min: (field, min) => `${field} must be at least ${min} characters`,
  max: (field, max) => `${field} must not exceed ${max} characters`,
  date: "Please enter a valid date",
  futureDate: "Date cannot be in the future",
  pastDate: "Date cannot be in the past",
  positive: "Value must be positive",
  alphanumeric:
    "Only letters, numbers, spaces, hyphens and underscores are allowed",
};

// Login validation schema
export const loginSchema = yup.object().shape({
  email: yup
    .string()
    .email(messages.email)
    .required(messages.required("Email")),
  password: yup
    .string()
    .min(6, messages.min("Password", 6))
    .required(messages.required("Password")),
});

// Registration validation schema
export const registrationSchema = yup.object().shape({
  firstName: yup
    .string()
    .matches(
      patterns.name,
      "Only letters, spaces, hyphens and apostrophes are allowed",
    )
    .min(2, messages.min("First name", 2))
    .max(50, messages.max("First name", 50))
    .required(messages.required("First name")),
  lastName: yup
    .string()
    .matches(
      patterns.name,
      "Only letters, spaces, hyphens and apostrophes are allowed",
    )
    .min(2, messages.min("Last name", 2))
    .max(50, messages.max("Last name", 50))
    .required(messages.required("Last name")),
  email: yup
    .string()
    .email(messages.email)
    .required(messages.required("Email")),
  phone: yup
    .string()
    .matches(patterns.phone, messages.phone)
    .required(messages.required("Phone number")),
  password: yup
    .string()
    .min(8, messages.min("Password", 8))
    .matches(patterns.password, messages.password)
    .required(messages.required("Password")),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password"), null], messages.passwordMatch)
    .required(messages.required("Confirm password")),
  role: yup
    .string()
    .oneOf(["admin", "doctor", "nurse", "staff", "guardian"], "Invalid role")
    .required(messages.required("Role")),
});

// Infant validation schema
export const infantSchema = yup.object().shape({
  firstName: yup
    .string()
    .matches(
      patterns.name,
      "Only letters, spaces, hyphens and apostrophes are allowed",
    )
    .min(2, messages.min("First name", 2))
    .max(50, messages.max("First name", 50))
    .required(messages.required("First name")),
  lastName: yup
    .string()
    .matches(
      patterns.name,
      "Only letters, spaces, hyphens and apostrophes are allowed",
    )
    .min(2, messages.min("Last name", 2))
    .max(50, messages.max("Last name", 50))
    .required(messages.required("Last name")),
  dateOfBirth: yup
    .date()
    .max(new Date(), messages.futureDate)
    .required(messages.required("Date of birth")),
  gender: yup
    .string()
    .oneOf(["male", "female", "other"], "Invalid gender")
    .required(messages.required("Gender")),
  birthWeight: yup
    .number()
    .positive(messages.positive)
    .max(10, "Birth weight seems too high")
    .nullable(),
  birthHeight: yup
    .number()
    .positive(messages.positive)
    .max(70, "Birth height seems too high")
    .nullable(),
  guardianId: yup.number().required(messages.required("Guardian")),
  bloodType: yup
    .string()
    .oneOf(
      ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"],
      "Invalid blood type",
    )
    .nullable(),
  allergies: yup
    .string()
    .max(500, messages.max("Allergies information", 500))
    .nullable(),
  medicalConditions: yup
    .string()
    .max(1000, messages.max("Medical conditions", 1000))
    .nullable(),
});

// Guardian validation schema
export const guardianSchema = yup.object().shape({
  firstName: yup
    .string()
    .matches(
      patterns.name,
      "Only letters, spaces, hyphens and apostrophes are allowed",
    )
    .min(2, messages.min("First name", 2))
    .max(50, messages.max("First name", 50))
    .required(messages.required("First name")),
  lastName: yup
    .string()
    .matches(
      patterns.name,
      "Only letters, spaces, hyphens and apostrophes are allowed",
    )
    .min(2, messages.min("Last name", 2))
    .max(50, messages.max("Last name", 50))
    .required(messages.required("Last name")),
  email: yup
    .string()
    .email(messages.email)
    .required(messages.required("Email")),
  phone: yup
    .string()
    .matches(patterns.phone, messages.phone)
    .required(messages.required("Phone number")),
  alternatePhone: yup
    .string()
    .matches(patterns.phone, messages.phone)
    .nullable(),
  address: yup
    .string()
    .min(5, messages.min("Address", 5))
    .max(200, messages.max("Address", 200))
    .required(messages.required("Address")),
  city: yup
    .string()
    .min(2, messages.min("City", 2))
    .max(50, messages.max("City", 50))
    .required(messages.required("City")),
  postalCode: yup
    .string()
    .matches(patterns.postalCode, "Please enter a valid postal code")
    .required(messages.required("Postal code")),
  emergencyContactName: yup
    .string()
    .matches(
      patterns.name,
      "Only letters, spaces, hyphens and apostrophes are allowed",
    )
    .min(2, messages.min("Emergency contact name", 2))
    .max(100, messages.max("Emergency contact name", 100))
    .nullable(),
  emergencyContactPhone: yup
    .string()
    .matches(patterns.phone, messages.phone)
    .nullable(),
});

// Appointment validation schema
export const appointmentSchema = yup.object().shape({
  infantId: yup.number().required(messages.required("Infant")),
  appointmentType: yup
    .string()
    .oneOf(
      ["vaccination", "checkup", "followup", "consultation"],
      "Invalid appointment type",
    )
    .required(messages.required("Appointment type")),
  appointmentDate: yup
    .date()
    .min(new Date(), messages.pastDate)
    .required(messages.required("Appointment date")),
  startTime: yup.string().required(messages.required("Start time")),
  endTime: yup
    .string()
    .required(messages.required("End time"))
    .test(
      "is-after-start",
      "End time must be after start time",
      function (value) {
        const { startTime } = this.parent;
        return !startTime || !value || value > startTime;
      },
    ),
  notes: yup.string().max(500, messages.max("Notes", 500)).nullable(),
  vaccines: yup
    .array()
    .of(yup.number())
    .when("appointmentType", {
      is: "vaccination",
      then: yup.array().min(1, "Please select at least one vaccine"),
      otherwise: yup.array(),
    }),
});

// Vaccination record validation schema
export const vaccinationRecordSchema = yup.object().shape({
  infantId: yup.number().required(messages.required("Infant")),
  vaccineId: yup.number().required(messages.required("Vaccine")),
  doseNumber: yup
    .number()
    .positive(messages.positive)
    .required(messages.required("Dose number")),
  administeredDate: yup
    .date()
    .max(new Date(), messages.futureDate)
    .required(messages.required("Administered date")),
  administeredBy: yup
    .number()
    .required(messages.required("Healthcare provider")),
  batchId: yup.number().required(messages.required("Vaccine batch")),
  site: yup
    .string()
    .oneOf(
      ["left_arm", "right_arm", "left_thigh", "right_thigh", "oral"],
      "Invalid site",
    )
    .required(messages.required("Administration site")),
  notes: yup.string().max(1000, messages.max("Notes", 1000)).nullable(),
  sideEffects: yup
    .string()
    .max(500, messages.max("Side effects", 500))
    .nullable(),
});

// Password change validation schema
export const passwordChangeSchema = yup.object().shape({
  currentPassword: yup.string().required(messages.required("Current password")),
  newPassword: yup
    .string()
    .min(8, messages.min("New password", 8))
    .matches(patterns.password, messages.password)
    .notOneOf(
      [yup.ref("currentPassword")],
      "New password must be different from current password",
    )
    .required(messages.required("New password")),
  confirmNewPassword: yup
    .string()
    .oneOf([yup.ref("newPassword"), null], messages.passwordMatch)
    .required(messages.required("Confirm new password")),
});

// Profile update validation schema
export const profileUpdateSchema = yup.object().shape({
  firstName: yup
    .string()
    .matches(
      patterns.name,
      "Only letters, spaces, hyphens and apostrophes are allowed",
    )
    .min(2, messages.min("First name", 2))
    .max(50, messages.max("First name", 50))
    .required(messages.required("First name")),
  lastName: yup
    .string()
    .matches(
      patterns.name,
      "Only letters, spaces, hyphens and apostrophes are allowed",
    )
    .min(2, messages.min("Last name", 2))
    .max(50, messages.max("Last name", 50))
    .required(messages.required("Last name")),
  phone: yup
    .string()
    .matches(patterns.phone, messages.phone)
    .required(messages.required("Phone number")),
  address: yup
    .string()
    .min(5, messages.min("Address", 5))
    .max(200, messages.max("Address", 200))
    .nullable(),
});

// Validation helper function
export const validateForm = async (schema, data) => {
  try {
    await schema.validate(data, { abortEarly: false });
    return { isValid: true, errors: {} };
  } catch (err) {
    const errors = {};
    err.inner.forEach((error) => {
      errors[error.path] = error.message;
    });
    return { isValid: false, errors };
  }
};

// Real-time validation helper
export const validateField = async (schema, field, value) => {
  try {
    await schema.validateAt(field, { [field]: value });
    return { isValid: true, error: null };
  } catch (err) {
    return { isValid: false, error: err.message };
  }
};

const validationExports = {
  loginSchema,
  registrationSchema,
  infantSchema,
  guardianSchema,
  appointmentSchema,
  vaccinationRecordSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  validateForm,
  validateField,
  patterns,
  messages,
};

export default validationExports;
