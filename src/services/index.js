/**
 * Services Index
 * Centralized export for all service modules
 */

export { default as BaseService, handleApiResponse } from "./baseService";
export { default as userService } from "./userService";
export { default as infantService } from "./infantService";
export { default as appointmentService } from "./appointmentService";
export { default as vaccinationService } from "./vaccinationService";
export { default as inventoryService } from "./inventoryService";
export { default as notificationService } from "./notificationService";
export { default as guardianNotificationService } from "./guardianNotificationService";

// Re-export apiClient for backward compatibility
export { default as apiClient } from "../utils/api";
