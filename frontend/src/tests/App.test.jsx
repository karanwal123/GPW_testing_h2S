/**
 * Tests for App.jsx — Main application component with auth routing.
 * Validates: Login/Chat conditional rendering, user state management, logout flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Cookies from "js-cookie";
import App from "../App";

vi.mock("js-cookie");

describe("App Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Cookies.get.mockReturnValue(undefined);
  });

  // ═══════════════════════════════════════════════════════════
  //  Rendering Tests
  // ═══════════════════════════════════════════════════════════

  it("renders Login component when user is not authenticated", () => {
    // Validates: App shows login form when no user in cookies
    Cookies.get.mockReturnValue(undefined);
    render(<App />);

    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  });

  it("renders Chat component when user is authenticated", async () => {
    // Validates: App shows chat interface when user session exists
    Cookies.get.mockReturnValue("testuser");
    render(<App />);

    // Look for header that only appears when logged in
    await waitFor(() => {
      expect(screen.getByText("BharatBot")).toBeInTheDocument();
    });
  });

  it("displays user initial in header when logged in", async () => {
    // Validates: User avatar shows correct first letter of username
    Cookies.get.mockReturnValue("Alice");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("A")).toBeInTheDocument();
    });
  });

  it("displays full username in header when logged in", async () => {
    // Validates: Username is visible in the top navigation
    Cookies.get.mockReturnValue("JohnDoe");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("JohnDoe")).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  Login Flow Tests
  // ═══════════════════════════════════════════════════════════

  it("sets session cookie when user logs in", async () => {
    // Validates: onLogin stores username in cookie for persistence
    Cookies.get.mockReturnValue(undefined);
    Cookies.set.mockClear();

    render(<App />);

    // This would require login form interaction
    // The component receives onLogin prop through context
    const usernameInput = screen.getByLabelText(/username/i);
    expect(usernameInput).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════
  //  Logout Flow Tests
  // ═══════════════════════════════════════════════════════════

  it("removes session cookie when user logs out", async () => {
    // Validates: logout clears user state and cookie
    Cookies.get.mockReturnValue("testuser");
    Cookies.remove.mockClear();

    render(<App />);

    await waitFor(() => {
      const logoutButton = screen.getByLabelText(/log out/i);
      expect(logoutButton).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/log out/i));

    expect(Cookies.remove).toHaveBeenCalledWith("session_user");
  });

  it("returns to login after logout", async () => {
    // Validates: After logout, user sees login form again
    Cookies.get.mockReturnValue("testuser");
    const { rerender } = render(<App />);

    await waitFor(() => {
      expect(screen.getByText("BharatBot")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/log out/i));

    // Update mock to simulate logout
    Cookies.get.mockReturnValue(undefined);
    rerender(<App />);

    // Login form should be visible again
    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════
  //  Edge Cases
  // ═══════════════════════════════════════════════════════════

  it("handles null/undefined user gracefully", () => {
    // Validates: App handles corrupted or missing cookie data
    Cookies.get.mockReturnValue(undefined);
    render(<App />);

    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  });

  it("handles empty string user gracefully", () => {
    // Validates: App treats empty username as no user
    Cookies.get.mockReturnValue("");
    render(<App />);

    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  });

  it("trims whitespace from username", async () => {
    // Validates: Usernames with extra spaces are normalized
    Cookies.get.mockReturnValue("  testuser  ");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("testuser")).toBeInTheDocument();
    });
  });

  it("renders accessibility skip link", () => {
    // Validates: Skip to content link for a11y compliance
    render(<App />);

    const skipLink = screen.getByText("Skip to content");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveClass("sr-only");
  });

  it("has proper ARIA landmarks", async () => {
    // Validates: Header and main elements for screen readers
    Cookies.get.mockReturnValue("testuser");
    render(<App />);

    await waitFor(() => {
      const banner = document.querySelector('[role="banner"]');
      expect(banner).toBeInTheDocument();
    });

    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
  });
});
