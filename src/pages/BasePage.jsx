import React from "react";
import { Card } from "../components/UI";

const BasePage = ({ title, description, children }) => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
};

export default BasePage;
