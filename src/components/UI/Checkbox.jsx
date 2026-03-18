/**
 * Checkbox Component
 * WCAG 2.1 AA compliant checkbox wrapper around Material UI Checkbox
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Checkbox as MuiCheckbox,
  FormControlLabel,
  FormHelperText
} from '@mui/material';

/**
 * Standalone Checkbox component
 */
const Checkbox = ({
  checked,
  onChange,
  disabled = false,
  color = 'primary',
  size = 'medium',
  inputProps = {},
  ...props
}) => {
  return (
    <MuiCheckbox
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      color={color}
      size={size}
      inputProps={{
        'aria-label': props['aria-label'] || props.label,
        ...inputProps
      }}
      {...props}
    />
  );
};

Checkbox.propTypes = {
  /** Whether the checkbox is checked */
  checked: PropTypes.bool,
  /** Callback when checkbox is changed */
  onChange: PropTypes.func,
  /** Whether the checkbox is disabled */
  disabled: PropTypes.bool,
  /** Color of the checkbox */
  color: PropTypes.oneOf(['primary', 'secondary', 'default', 'error', 'info', 'success', 'warning']),
  /** Size of the checkbox */
  size: PropTypes.oneOf(['small', 'medium']),
  /** Additional input props */
  inputProps: PropTypes.object,
  /** Label for the checkbox */
  label: PropTypes.string,
  /** Aria-label for accessibility */
  'aria-label': PropTypes.string,
};

/**
 * Checkbox with Label - FormControlLabel wrapper
 */
export const CheckboxWithLabel = ({
  label,
  checked,
  onChange,
  disabled = false,
  color = 'primary',
  size = 'medium',
  error,
  helperText,
  ...props
}) => {
  return (
    <>
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            color={color}
            size={size}
            label={label}
          />
        }
        label={label}
        disabled={disabled}
        {...props}
      />
      {helperText && (
        <FormHelperText error={error}>
          {helperText}
        </FormHelperText>
      )}
    </>
  );
};

CheckboxWithLabel.propTypes = {
  /** Label text */
  label: PropTypes.string.isRequired,
  /** Whether the checkbox is checked */
  checked: PropTypes.bool,
  /** Callback when checkbox is changed */
  onChange: PropTypes.func,
  /** Whether the checkbox is disabled */
  disabled: PropTypes.bool,
  /** Color of the checkbox */
  color: PropTypes.oneOf(['primary', 'secondary', 'default', 'error', 'info', 'success', 'warning']),
  /** Size of the checkbox */
  size: PropTypes.oneOf(['small', 'medium']),
  /** Whether to show error state */
  error: PropTypes.bool,
  /** Helper text to display below */
  helperText: PropTypes.string,
};

export default Checkbox;
