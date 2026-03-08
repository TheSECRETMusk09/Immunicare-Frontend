import React from "react";

const Card = ({
  children,
  className = "",
  title,
  footer,
  noPadding = false,
  ...props
}) => {
  return (
    <div
      className={`rounded-xl shadow-sm border transition-colors bg-[var(--color-bg-elevated)] border-[var(--color-border-light)] text-[var(--color-text-primary)] ${className}`}
      {...props}
    >
      {title && (
        <div className="px-4 py-3 border-b border-[var(--color-border-light)]">
          {typeof title === "string" ? (
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {title}
            </h3>
          ) : (
            title
          )}
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>{children}</div>
      {footer && (
        <div className="px-4 py-3 border-t border-[var(--color-border-light)]">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
