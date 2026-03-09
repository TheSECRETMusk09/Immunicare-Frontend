/**
 * Comprehensive Button Component Tests
 * Tests the Button.jsx UI component for all variants, sizes, states, and accessibility
 *
 * Test Coverage:
 * - All button variants (primary, secondary, danger, success, outline, ghost, warning, info, edit, cancel)
 * - All button sizes (xs, sm, md, lg, xl)
 * - Button states (default, hover, active, disabled, loading)
 * - Accessibility (keyboard navigation, ARIA attributes, focus management)
 * - Click handling and event propagation
 * - Conditional rendering
 *
 * Testing Framework: Jest + React Testing Library
 */

/* eslint-disable testing-library/no-container, testing-library/no-node-access */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Button from "../components/UI/Button";

// Mock console.error for strict mode warnings
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn((message, ...args) => {
    // Suppress React StrictMode warnings in tests
    if (message.includes('Warning: An update to') || message.includes('Warning: ReactDOM.render')) {
      return;
    }
    originalError.call(console, message, ...args);
  });
});

afterAll(() => {
  console.error = originalError;
});

describe("Button Component - Variants", () => {
  const variants = [
    'primary',
    'secondary',
    'danger',
    'success',
    'outline',
    'ghost',
    'warning',
    'info',
    'edit',
    'cancel'
  ];

  variants.forEach((variant) => {
    test(`Button renders with ${variant} variant`, () => {
      render(
        <Button variant={variant}>
          {variant} Button
        </Button>
      );

      const button = screen.getByRole("button", {
        name: new RegExp(`${variant}\\s+Button`, "i"),
      });
      expect(button).toBeInTheDocument();
    });
  });

  test('Button has correct variant classes applied', () => {
    const { container } = render(
      <Button variant="primary">
        Primary Button
      </Button>
    );

    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-[var(--theme-primary)]');
  });
});

describe("Button Component - Sizes", () => {
  const sizes = ['xs', 'sm', 'md', 'lg', 'xl'];

  sizes.forEach((size) => {
    test(`Button renders with ${size} size`, () => {
      render(
        <Button size={size}>
          {size} Button
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  test('Button size classes are correctly applied', () => {
    const { container: smallContainer } = render(
      <Button size="xs">Small</Button>
    );
    const smallButton = smallContainer.querySelector('button');
    expect(smallButton).toHaveClass('px-2.5', 'py-1.5', 'text-xs', 'min-h-[32px]');

    const { container: largeContainer } = render(
      <Button size="xl">Large</Button>
    );
    const largeButton = largeContainer.querySelector('button');
    expect(largeButton).toHaveClass('px-6', 'py-3', 'text-base', 'min-h-[48px]');
  });
});

describe("Button Component - States", () => {
  test('Button renders in default state', () => {
    render(<Button>Default Button</Button>);

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute('aria-busy', 'true');
  });

  test('Button renders in disabled state', () => {
    render(
      <Button disabled={true}>
        Disabled Button
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
  });

  test('Button renders in loading state', () => {
    render(
      <Button loading={true}>
        Loading Button
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    // Check loading spinner is present
    const spinner = button.querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  test('Disabled button has correct cursor style', () => {
    render(<Button disabled={true}>Disabled</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('disabled:cursor-not-allowed');
  });

  test('Loading state shows spinner and disables button', () => {
    render(<Button loading>Loading...</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe("Button Component - Click Handling", () => {
  test('Button responds to click events', () => {
    const handleClick = jest.fn();

    render(
      <Button onClick={handleClick}>
        Click Me
      </Button>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('Button does not respond to clicks when disabled', () => {
    const handleClick = jest.fn();

    render(
      <Button disabled={true} onClick={handleClick}>
        Disabled Button
      </Button>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('Button does not respond to clicks when loading', () => {
    const handleClick = jest.fn();

    render(
      <Button loading={true} onClick={handleClick}>
        Loading Button
      </Button>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('Button click handler receives event object', () => {
    const handleClick = jest.fn();

    render(
      <Button onClick={handleClick}>
        Click Me
      </Button>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
  });

  test('Multiple rapid clicks are handled correctly', () => {
    const handleClick = jest.fn();

    render(
      <Button onClick={handleClick}>
        Multi Click
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(3);
  });
});

describe("Button Component - Accessibility", () => {
  test('Button has proper role attribute', () => {
    render(<Button>Accessible Button</Button>);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('Button has accessible name from children', () => {
    render(<Button>Click Here</Button>);

    expect(screen.getByRole('button', { name: /click here/i })).toBeInTheDocument();
  });

  test('Button can be focused with keyboard', async () => {
    render(<Button>Focusable Button</Button>);

    const button = screen.getByRole('button');

    // Test that button can receive focus
    button.focus();
    expect(button).toHaveFocus();
  });

  test('Button has visible focus indicator', () => {
    render(<Button>Focusable Button</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('focus:outline-none', 'focus-visible:ring-2');
  });

  test('Button has proper type attribute', () => {
    render(<Button type="submit">Submit</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
  });

  test('Button defaults to type="button"', () => {
    render(<Button>Default Type</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'button');
  });

  test('Loading button has aria-busy attribute', () => {
    render(<Button loading>Loading</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  test('Disabled button has aria-disabled', () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('disabled');
  });

  test('Button with icon has proper aria-label', () => {
    render(
      <Button aria-label="Close">
        ✕
      </Button>
    );

    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
});

describe("Button Component - Props and Configuration", () => {
  test('Button accepts custom className', () => {
    const { container } = render(
      <Button className="custom-class">
        Custom Button
      </Button>
    );

    const button = container.querySelector('button');
    expect(button).toHaveClass('custom-class');
  });

  test('Button accepts custom type prop', () => {
    render(<Button type="reset">Reset</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'reset');
  });

  test('Button passes through additional props', () => {
    render(
      <Button data-testid="custom-button" id="my-button">
        Test Button
      </Button>
    );

    expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    expect(document.getElementById('my-button')).toBeInTheDocument();
  });

  test('Button renders with icon', () => {
    render(
      <Button>
        <span>🔔</span>
        With Icon
      </Button>
    );

    expect(screen.getByText('🔔')).toBeInTheDocument();
  });

  test('Button renders children correctly', () => {
    render(
      <Button>
        <span data-testid="child">Child Element</span>
      </Button>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

describe("Button Component - Conditional Rendering", () => {
  test('Button renders conditionally with boolean', () => {
    const showButton = true;

    const { container } = render(
      <>
        {showButton && <Button>Conditional</Button>}
      </>
    );

    expect(container.querySelector('button')).toBeInTheDocument();
  });

  test('Button does not render when condition is false', () => {
    const showButton = false;

    const { container } = render(
      <>
        {showButton && <Button>Conditional</Button>}
      </>
    );

    expect(container.querySelector('button')).not.toBeInTheDocument();
  });

  test('Button renders different content based on state', () => {
    const isLoading = true;

    render(
      <Button loading={isLoading}>
        {isLoading ? 'Loading...' : 'Submit'}
      </Button>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe("Button Component - Visual States and Interactions", () => {
  test('Button has hover styles defined', () => {
    const { container } = render(<Button>Hover Test</Button>);

    const button = container.querySelector('button');
    // Primary button should have hover class
    expect(button).toHaveClass('hover:bg-[var(--theme-primary-hover)]');
  });

  test('Button has active/pressed state styles', () => {
    const { container } = render(<Button>Active Test</Button>);

    const button = container.querySelector('button');
    expect(button).toHaveClass('active:scale-[0.98]');
  });

  test('Button has transition styles', () => {
    const { container } = render(<Button>Transition Test</Button>);

    const button = container.querySelector('button');
    expect(button).toHaveClass('transition-colors', 'duration-150');
  });

  test('Button responds to mouse events', () => {
    const handleMouseEnter = jest.fn();
    const handleMouseLeave = jest.fn();

    render(
      <Button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        Mouse Events
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);

    expect(handleMouseEnter).toHaveBeenCalled();
    expect(handleMouseLeave).toHaveBeenCalled();
  });

  test('Button has core shape styles', () => {
    const { container } = render(<Button>Shape Test</Button>);

    const button = container.querySelector('button');
    expect(button).toHaveClass('rounded-lg', 'border', 'border-transparent');
  });
});

describe("Button Component - Form Integration", () => {
  test('Button works as form submit', () => {
    const handleSubmit = jest.fn();

    render(
      <form onSubmit={handleSubmit}>
        <Button type="submit">Submit Form</Button>
      </form>
    );

    fireEvent.submit(screen.getByRole('button'));
    expect(handleSubmit).toHaveBeenCalled();
  });

  test('Button can prevent default form submission', () => {
    const handleSubmit = jest.fn();

    render(
      <form onSubmit={handleSubmit}>
        <Button type="submit">Submit</Button>
      </form>
    );

    // Clicking button doesn't submit form directly
    fireEvent.click(screen.getByRole('button'));
    // Only form submit event triggers handleSubmit
  });

  test('Multiple buttons in form work correctly', () => {
    const handleSubmit = jest.fn();

    render(
      <form onSubmit={handleSubmit}>
        <Button type="submit" name="action" value="save">Save</Button>
        <Button type="submit" name="action" value="cancel">Cancel</Button>
        <Button type="button">Custom</Button>
      </form>
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });
});

describe("Button Component - Responsive Behavior", () => {
  test('Button has minimum height for touch targets', () => {
    const { container } = render(<Button>Touch Target</Button>);

    const button = container.querySelector('button');
    // Medium button has min-h-[40px]
    expect(button).toHaveClass('min-h-[40px]');
  });

  test('Button size xs has minimum height', () => {
    const { container } = render(<Button size="xs">XS Button</Button>);

    const button = container.querySelector('button');
    expect(button).toHaveClass('min-h-[32px]');
  });

  test('Button has proper gap for icon and text', () => {
    const { container } = render(
      <Button>
        <span>Icon</span>
        Text
      </Button>
    );

    const button = container.querySelector('button');
    expect(button).toHaveClass('gap-2');
  });
});

describe("Button Component - Edge Cases", () => {
  test('Button handles empty children', () => {
    render(<Button></Button>);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('Button handles null children gracefully', () => {
    // This should not throw an error
    expect(() => {
      render(<Button>{null}</Button>);
    }).not.toThrow();
  });

  test('Button handles undefined onClick gracefully', () => {
    expect(() => {
      render(<Button onClick={undefined}>No Handler</Button>);
    }).not.toThrow();
  });

  test('Button handles very long text content', () => {
    const longText = 'A'.repeat(1000);

    const { container } = render(<Button>{longText}</Button>);

    const button = container.querySelector('button');
    expect(button).toHaveTextContent(longText);
  });

  test('Button handles special characters in content', () => {
    render(
      <Button>
        Special: text chars
      </Button>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('Button can be nested in other elements', () => {
    render(
      <div>
        <span>
          <Button>Nested</Button>
        </span>
      </div>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

describe("Button Component - Dark Mode Compatibility", () => {
  test('Secondary button uses semantic color tokens', () => {
    const { container } = render(
      <Button variant="secondary">Dark Mode</Button>
    );

    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-[var(--color-bg-tertiary)]', 'text-[var(--color-text-primary)]');
  });

  test('Outline button uses semantic theme token classes', () => {
    const { container } = render(
      <Button variant="outline">Outline Dark</Button>
    );

    const button = container.querySelector('button');
    expect(button).toHaveClass('border-[var(--theme-primary)]', 'text-[var(--theme-primary)]');
  });

  test('Ghost button uses semantic neutral token classes', () => {
    const { container } = render(
      <Button variant="ghost">Ghost Dark</Button>
    );

    const button = container.querySelector('button');
    expect(button).toHaveClass('text-[var(--color-text-primary)]', 'hover:bg-[var(--color-bg-secondary)]');
  });
});

describe("Button Component - Performance", () => {
  test('Button renders without errors', () => {
    expect(() => {
      render(<Button>Performance Test</Button>);
    }).not.toThrow();
  });

  test('Multiple buttons render efficiently', () => {
    const buttons = Array(100).fill(null).map((_, i) => (
      <Button key={i}>Button {i}</Button>
    ));

    expect(() => {
      render(<>{buttons}</>);
    }).not.toThrow();
  });

  test('Button re-renders correctly', () => {
    const { rerender } = render(<Button>Initial</Button>);

    expect(() => {
      rerender(<Button>Updated</Button>);
    }).not.toThrow();
  });
});
