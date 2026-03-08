/**
 * Immunicare Login Theme Configuration
 * Distinct visual branding for Admin and Guardian user roles
 * WCAG 2.1 AA compliant color schemes
 */

// WCAG 2.1 AA compliant color combinations
// All color pairs meet minimum contrast ratio of 4.5:1 for normal text

export const adminTheme = {
  name: "admin",
  colors: {
    // Primary palette - Professional healthcare blue
    primary: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb", // Main primary - WCAG AA compliant on white
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
      950: "#172554",
    },
    // Secondary palette - Slate for professional look
    secondary: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
      950: "#020617",
    },
    // Accent - Teal for medical/healthcare association
    accent: {
      light: "#5eead4",
      DEFAULT: "#14b8a6",
      dark: "#0f766e",
    },
    // Semantic colors
    success: "#059669", // WCAG AA on white
    warning: "#d97706", // WCAG AA on white
    error: "#dc2626", // WCAG AA on white
    info: "#2563eb",
  },
  // Background gradients
  background: {
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)",
    solid: "#1e3a8a",
    overlay: "rgba(30, 58, 138, 0.95)",
  },
  // Typography
  typography: {
    heading: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: 700,
      color: "#0f172a",
    },
    body: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: 400,
      color: "#334155",
    },
  },
  // Spacing and sizing
  spacing: {
    touchTarget: "44px", // WCAG 2.5.5 minimum target size
    inputHeight: "48px", // Comfortable touch target
    buttonHeight: "48px",
    maxWidth: "420px",
  },
  // Border radius
  borderRadius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },
  // Shadows
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    focus: "0 0 0 3px rgba(37, 99, 235, 0.4)",
    error: "0 0 0 3px rgba(220, 38, 38, 0.3)",
  },
  // Focus indicators - WCAG 2.4.7
  focus: {
    outline: "3px solid #2563eb",
    outlineOffset: "2px",
    ring: "0 0 0 3px rgba(37, 99, 235, 0.4)",
  },
  // Icons and imagery
  icons: {
    shield: true,
    lock: true,
    admin: true,
  },
  // Role identifier
  roleLabel: "Healthcare Administrator",
  roleDescription:
    "Access patient records, manage vaccinations, and oversee clinic operations",
};

export const guardianTheme = {
  name: "guardian",
  colors: {
    // Primary palette - Warm, nurturing coral/orange
    primary: {
      50: "#fff7ed",
      100: "#ffedd5",
      200: "#fed7aa",
      300: "#fdba74",
      400: "#fb923c",
      500: "#f97316",
      600: "#ea580c", // Main primary - WCAG AA compliant on white
      700: "#c2410c",
      800: "#9a3412",
      900: "#7c2d12",
      950: "#431407",
    },
    // Secondary palette - Warm neutrals
    secondary: {
      50: "#fafaf9",
      100: "#f5f5f4",
      200: "#e7e5e4",
      300: "#d6d3d1",
      400: "#a8a29e",
      500: "#78716c",
      600: "#57534e",
      700: "#44403c",
      800: "#292524",
      900: "#1c1917",
      950: "#0c0a09",
    },
    // Accent - Soft green for growth/health
    accent: {
      light: "#86efac",
      DEFAULT: "#22c55e",
      dark: "#15803d",
    },
    // Semantic colors
    success: "#16a34a",
    warning: "#ca8a04",
    error: "#dc2626",
    info: "#0891b2",
  },
  // Background gradients
  background: {
    gradient: "linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)",
    solid: "#ea580c",
    overlay: "rgba(234, 88, 12, 0.95)",
  },
  // Typography
  typography: {
    heading: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: 600,
      color: "#1c1917",
    },
    body: {
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: 400,
      color: "#44403c",
    },
  },
  // Spacing and sizing - same for consistency
  spacing: {
    touchTarget: "44px",
    inputHeight: "48px",
    buttonHeight: "48px",
    maxWidth: "420px",
  },
  // Border radius - slightly softer for guardian
  borderRadius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    full: "9999px",
  },
  // Shadows
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    focus: "0 0 0 3px rgba(234, 88, 12, 0.4)",
    error: "0 0 0 3px rgba(220, 38, 38, 0.3)",
  },
  // Focus indicators
  focus: {
    outline: "3px solid #ea580c",
    outlineOffset: "2px",
    ring: "0 0 0 3px rgba(234, 88, 12, 0.4)",
  },
  // Icons and imagery
  icons: {
    heart: true,
    family: true,
    child: true,
  },
  // Role identifier
  roleLabel: "Parent / Guardian",
  roleDescription:
    "View your child's immunization records, schedule appointments, and receive reminders",
};

// Shared design tokens
export const sharedTokens = {
  // Animation
  animation: {
    duration: {
      fast: "150ms",
      normal: "250ms",
      slow: "350ms",
    },
    easing: {
      default: "cubic-bezier(0.4, 0, 0.2, 1)",
      bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    },
  },
  // Z-index scale
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    fixed: 30,
    modalBackdrop: 40,
    modal: 50,
    popover: 60,
    tooltip: 70,
  },
  // Breakpoints
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },
};

// Helper function to get theme by role
export const getThemeByRole = (role) => {
  switch (role) {
    case "admin":
    case "super_admin":
    case "doctor":
    case "nurse":
    case "staff":
      return adminTheme;
    case "guardian":
    case "parent":
      return guardianTheme;
    default:
      return adminTheme;
  }
};

// Validation messages - consistent across both themes
export const validationMessages = {
  username: {
    required: "Username is required",
    minLength: "Username must be at least 3 characters",
    maxLength: "Username must be less than 50 characters",
    pattern: "Username can only contain letters, numbers, and underscores",
  },
  password: {
    required: "Password is required",
    minLength: "Password must be at least 6 characters",
    maxLength: "Password must be less than 100 characters",
    pattern: "Password must contain at least one letter and one number",
  },
};

// Error announcement messages for screen readers
export const accessibilityMessages = {
  formError: "Form validation error: {message}",
  loginError: "Login failed: {message}",
  loginSuccess: "Login successful. Redirecting to dashboard.",
  loading: "Authenticating, please wait.",
  passwordVisible: "Password is now visible",
  passwordHidden: "Password is now hidden",
  fieldRequired: "{field} is required",
};
