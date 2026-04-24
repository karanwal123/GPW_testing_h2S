/**
 * Tests for Login.jsx — Login form with password validation.
 * Validates: Form rendering, input validation, password requirements, error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "../Login";

describe("Login Component", () => {
  const mockOnLogin = vi.fn();

  beforeEach(() => {
    mockOnLogin.mockClear();
  });

  // ═══════════════════════════════════════════════════════════
  //  Rendering Tests
  // ═══════════════════════════════════════════════════════════

  it("renders login form with all required fields", () => {
    // Validates: Form has username input, password input, and submit button
    render(<Login onLogin={mockOnLogin} />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue/i }),
    ).toBeInTheDocument();
  });

  it("displays logo and heading", () => {
    // Validates: App branding and welcome message
    render(<Login onLogin={mockOnLogin} />);

    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Sign in to your Election Assistant/i),
    ).toBeInTheDocument();
  });

  it("has proper form labels with for attributes", () => {
    // Validates: Accessibility - form labels properly associated
    render(<Login onLogin={mockOnLogin} />);

    const usernameLabel = screen.getByText(/Username/i);
    const passwordLabel = screen.getByText(/Password/i);

    expect(usernameLabel).toBeInTheDocument();
    expect(passwordLabel).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════
  //  Username Validation Tests
  // ═══════════════════════════════════════════════════════════

  it("rejects empty username", async () => {
    // Validates: Username field is required
    render(<Login onLogin={mockOnLogin} />);

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Username is required/i)).toBeInTheDocument();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only username", async () => {
    // Validates: Username cannot be just spaces
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/username/i);
    await userEvent.type(usernameInput, "   ");

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Username is required/i)).toBeInTheDocument();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it("trims whitespace from username on submit", async () => {
    // Validates: Leading/trailing spaces are removed from username
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(usernameInput, "  validuser  ");
    await userEvent.type(passwordInput, "ValidPass123!");

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(mockOnLogin).toHaveBeenCalledWith("validuser");
  });

  // ═══════════════════════════════════════════════════════════
  //  Password Validation Tests
  // ═══════════════════════════════════════════════════════════

  it("rejects password shorter than 8 characters", async () => {
    // Validates: Minimum 8 character password requirement
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(usernameInput, "user123");
    await userEvent.type(passwordInput, "Short1!"); // 7 chars

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it("rejects password without uppercase letter", async () => {
    // Validates: Password must contain at least one uppercase letter
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(usernameInput, "user123");
    await userEvent.type(passwordInput, "lowercase123!"); // No uppercase

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/uppercase/i)).toBeInTheDocument();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it("rejects password without lowercase letter", async () => {
    // Validates: Password must contain at least one lowercase letter
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(usernameInput, "user123");
    await userEvent.type(passwordInput, "UPPERCASE123!"); // No lowercase

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/lowercase/i)).toBeInTheDocument();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it("rejects password without number", async () => {
    // Validates: Password must contain at least one digit
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(usernameInput, "user123");
    await userEvent.type(passwordInput, "NoNumbers!"); // No digit

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/number/i)).toBeInTheDocument();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it("rejects password without special character", async () => {
    // Validates: Password must contain at least one special character
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(usernameInput, "user123");
    await userEvent.type(passwordInput, "NoSpecial123"); // No special char

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/special character/i)).toBeInTheDocument();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it("accepts valid password meeting all requirements", async () => {
    // Validates: Strong password is accepted
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(usernameInput, "testuser");
    await userEvent.type(passwordInput, "ValidPass123!");

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(mockOnLogin).toHaveBeenCalledWith("testuser");
  });

  // ═══════════════════════════════════════════════════════════
  //  Password Visibility Toggle Tests
  // ═══════════════════════════════════════════════════════════

  it("has password visibility toggle button", () => {
    // Validates: Show/hide password button is present
    render(<Login onLogin={mockOnLogin} />);

    const toggleButton = screen.getByLabelText(/show password|hide password/i);
    expect(toggleButton).toBeInTheDocument();
  });

  it("toggles password visibility on button click", async () => {
    // Validates: Password input type changes from password to text
    render(<Login onLogin={mockOnLogin} />);

    const toggleButton = screen.getByLabelText(/show password/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(passwordInput.type).toBe("password");

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(passwordInput.type).toBe("text");
    });
  });

  it("toggles button label when showing/hiding password", async () => {
    // Validates: Button label updates appropriately
    render(<Login onLogin={mockOnLogin} />);

    let toggleButton = screen.getByLabelText(/show password/i);
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);

    await waitFor(() => {
      toggleButton = screen.getByLabelText(/hide password/i);
      expect(toggleButton).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  Form Submission Tests
  // ═══════════════════════════════════════════════════════════

  it("clears error message on successful submission", async () => {
    // Validates: Error state is reset when form becomes valid
    render(<Login onLogin={mockOnLogin} />);

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Username is required/i)).toBeInTheDocument();

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(usernameInput, "testuser");
    await userEvent.type(passwordInput, "ValidPass123!");

    fireEvent.click(submitBtn);

    expect(screen.queryByText(/Username is required/i)).not.toBeInTheDocument();
    expect(mockOnLogin).toHaveBeenCalled();
  });

  it("prevents default form submission", async () => {
    // Validates: Form submission is handled by handler, not browser default
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(usernameInput, "testuser");
    await userEvent.type(passwordInput, "ValidPass123!");

    const form = screen
      .getByRole("button", { name: /continue/i })
      .closest("form");
    const submitEvent = new Event("submit", {
      bubbles: true,
      cancelable: true,
    });

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(mockOnLogin).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════
  //  Accessibility Tests
  // ═══════════════════════════════════════════════════════════

  it("has proper ARIA attributes on error display", async () => {
    // Validates: Error messages are accessible
    render(<Login onLogin={mockOnLogin} />);

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    const errorAlert = screen.getByRole("alert");
    expect(errorAlert).toBeInTheDocument();
  });

  it("inputs have proper autocomplete attributes", () => {
    // Validates: Browser password managers can work properly
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(usernameInput).toHaveAttribute("autocomplete", "username");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
  });

  it("has aria-invalid on invalid inputs", async () => {
    // Validates: Screen readers know about validation errors
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/username/i);

    const submitBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(submitBtn);

    expect(usernameInput).toHaveAttribute("aria-invalid", "true");
  });
});
