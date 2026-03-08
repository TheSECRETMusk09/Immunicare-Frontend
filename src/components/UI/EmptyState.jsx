import React from "react";
import { Button } from "./index";

const EmptyState = ({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  action,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 ${className}`}
    >
      {Icon && (
        <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4 text-gray-400">
          {typeof Icon === "string" ? (
            <span className="text-4xl">{Icon}</span>
          ) : (
            <Icon className="w-10 h-10 text-gray-400" />
          )}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
          {description}
        </p>
      )}
      {((actionLabel && onAction) || action) &&
        (action || (
          <Button onClick={onAction} variant="primary">
            {actionLabel}
          </Button>
        ))}
    </div>
  );
};

export default EmptyState;
