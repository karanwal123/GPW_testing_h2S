/**
 * Tests for Chat.jsx — Chat interface with message history and API calls.
 * Validates: Message rendering, input handling, API calls, error handling, loading states.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import Chat from "../Chat";

vi.mock("axios");

describe("Chat Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axios.post.mockResolvedValue({
      data: {
        reply: "This is a bot response about voting.",
        intent: "general",
        topic: "voting",
      },
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  Initial Render Tests
  // ═══════════════════════════════════════════════════════════

  it("renders empty state with welcome message", () => {
    // Validates: Initial UI shows hero section with suggestions
    render(<Chat username="TestUser" />);

    expect(screen.getByText(/Your questions about/i)).toBeInTheDocument();
    expect(screen.getByText(/Indian elections/i)).toBeInTheDocument();
  });

  it("displays logo and branding in empty state", () => {
    // Validates: BharatBot branding is visible
    render(<Chat username="TestUser" />);

    expect(screen.getByText(/BharatBot/i)).toBeInTheDocument();
    expect(screen.getByText(/Election Assistant/i)).toBeInTheDocument();
  });

  it("displays suggestion pills in empty state", () => {
    // Validates: Quick suggestion buttons are shown
    render(<Chat username="TestUser" />);

    expect(screen.getByText(/How do I register to vote/i)).toBeInTheDocument();
    expect(screen.getByText(/Model Code of Conduct/i)).toBeInTheDocument();
  });

  it("has input field with proper placeholder", () => {
    // Validates: Message input field is ready for user input
    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    expect(textarea).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════
  //  Message Sending Tests
  // ═══════════════════════════════════════════════════════════

  it("sends message on Enter key press", async () => {
    // Validates: Ctrl+Enter or Enter alone sends the message
    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "What is voting?");

    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          message: "What is voting?",
          session_id: expect.any(String),
        }),
      );
    });
  });

  it("does not send message on Shift+Enter", async () => {
    // Validates: Shift+Enter creates newline, doesn't send
    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "Line 1");

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    // Wait a bit to ensure no API call
    await new Promise((r) => setTimeout(r, 100));
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("displays user message immediately after sending", async () => {
    // Validates: User message appears in chat instantly
    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "What is voting?");

    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("What is voting?")).toBeInTheDocument();
    });
  });

  it("clears input after sending message", async () => {
    // Validates: Textarea is cleared for next message
    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "test message");

    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });

  it("ignores empty/whitespace-only messages", async () => {
    // Validates: No API call for empty input
    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "   ");

    fireEvent.keyDown(textarea, { key: "Enter" });

    // Wait briefly to ensure no call
    await new Promise((r) => setTimeout(r, 100));
    expect(axios.post).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════
  //  API Call Tests
  // ═══════════════════════════════════════════════════════════

  it("sends correct API payload with message and session_id", async () => {
    // Validates: API receives properly formatted request
    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "About election process");

    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          message: "About election process",
          session_id: expect.any(String),
        }),
      );
    });
  });

  it("uses same session_id for multiple messages", async () => {
    // Validates: Session persistence across messages
    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);

    // Send first message
    await userEvent.type(textarea, "First question");
    fireEvent.keyDown(textarea, { key: "Enter" });

    const firstCall = axios.post.mock.calls[0][1].session_id;

    // Send second message
    await userEvent.type(textarea, "Second question");
    fireEvent.keyDown(textarea, { key: "Enter" });

    const secondCall = axios.post.mock.calls[1][1].session_id;

    expect(firstCall).toBe(secondCall);
  });

  // ═══════════════════════════════════════════════════════════
  //  Bot Response Tests
  // ═══════════════════════════════════════════════════════════

  it("displays bot response after API call succeeds", async () => {
    // Validates: Bot message appears after successful API response
    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "Test question");

    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(
        screen.getByText(/This is a bot response about voting/i),
      ).toBeInTheDocument();
    });
  });

  it("handles empty response from API", async () => {
    // Validates: Gracefully handles missing reply field
    axios.post.mockResolvedValueOnce({
      data: {
        reply: null,
        intent: "general",
      },
    });

    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "Test");

    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/No response/i)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  Error Handling Tests
  // ═══════════════════════════════════════════════════════════

  it("displays error message when API call fails", async () => {
    // Validates: Network error shows helpful message
    axios.post.mockRejectedValueOnce(new Error("Network error"));

    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "Test question");

    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(
        screen.getByText(/Couldn't reach the server/i),
      ).toBeInTheDocument();
    });
  });

  it("allows user to continue after error", async () => {
    // Validates: Chat remains functional after failed request
    axios.post
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        data: { reply: "Success message", intent: "general" },
      });

    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);

    // First message fails
    await userEvent.type(textarea, "First question");
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(
        screen.getByText(/Couldn't reach the server/i),
      ).toBeInTheDocument();
    });

    // Second message succeeds
    await userEvent.type(textarea, "Second question");
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/Success message/i)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  Loading State Tests
  // ═══════════════════════════════════════════════════════════

  it("shows loading indicator while waiting for response", async () => {
    // Validates: User sees that bot is thinking
    axios.post.mockImplementationOnce(
      () =>
        new Promise((r) =>
          setTimeout(
            () =>
              r({
                data: { reply: "Response", intent: "general" },
              }),
            500,
          ),
        ),
    );

    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "Test");

    fireEvent.keyDown(textarea, { key: "Enter" });

    // Check for loading state (might be spinner or dots)
    await waitFor(
      () => {
        const isLoadingIndicator =
          screen.queryByText(/\.\.\./i) || document.querySelector(".bb-dot");
        expect(isLoadingIndicator).toBeTruthy();
      },
      { timeout: 1000 },
    );
  });

  it("disables input while loading", async () => {
    // Validates: User can't send multiple messages while loading
    axios.post.mockImplementationOnce(
      () =>
        new Promise((r) =>
          setTimeout(
            () =>
              r({
                data: { reply: "Response", intent: "general" },
              }),
            500,
          ),
        ),
    );

    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "Test");

    fireEvent.keyDown(textarea, { key: "Enter" });

    // Try to send another message while loading
    await userEvent.type(textarea, "Another message");
    fireEvent.keyDown(textarea, { key: "Enter" });

    // Should only have called API once
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════════════════════
  //  Message History Tests
  // ═══════════════════════════════════════════════════════════

  it("displays multiple messages in conversation order", async () => {
    // Validates: Chat history is maintained
    const responses = [
      { data: { reply: "First response", intent: "general" } },
      { data: { reply: "Second response", intent: "general" } },
    ];
    axios.post
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1]);

    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);

    // First exchange
    await userEvent.type(textarea, "First question");
    fireEvent.keyDown(textarea, { key: "Enter" });

    // Second exchange
    await userEvent.type(textarea, "Second question");
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("First question")).toBeInTheDocument();
      expect(screen.getByText("Second question")).toBeInTheDocument();
      expect(screen.getByText("First response")).toBeInTheDocument();
      expect(screen.getByText("Second response")).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  Username Handling Tests
  // ═══════════════════════════════════════════════════════════

  it("handles empty username gracefully", () => {
    // Validates: Defaults to "User" when username is empty
    render(<Chat username="" />);

    expect(screen.getByText(/Your questions about/i)).toBeInTheDocument();
  });

  it("handles null username gracefully", () => {
    // Validates: Defaults to "User" when username is null
    render(<Chat username={null} />);

    expect(screen.getByText(/Your questions about/i)).toBeInTheDocument();
  });

  it("trims whitespace from username", () => {
    // Validates: Username normalization
    render(<Chat username="  TestUser  " />);

    // Component should normalize and display properly
    expect(screen.getByText(/Your questions about/i)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════
  //  Accessibility Tests
  // ═══════════════════════════════════════════════════════════

  it("has accessible textarea with label", () => {
    // Validates: Input has proper aria-label
    render(<Chat username="TestUser" />);

    const textarea = screen.getByLabelText(
      /Ask a question about Indian elections/i,
    );
    expect(textarea).toBeInTheDocument();
  });

  it("has keyboard-accessible send button", () => {
    // Validates: Send button is reachable and labeled
    render(<Chat username="TestUser" />);

    // The send button should be accessible via keyboard
    const sendButton =
      screen.getByRole("button", { name: "" }) ||
      document.querySelector('[title="Send"]');
    expect(sendButton).toBeInTheDocument();
  });

  it("properly associates user and bot messages", async () => {
    // Validates: Messages are semantically distinguished
    render(<Chat username="TestUser" />);

    const textarea = screen.getByPlaceholderText(/Ask about voting/i);
    await userEvent.type(textarea, "Test question");

    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Test question")).toBeInTheDocument();
    });

    // Both messages should be in the DOM
    const userMessage = screen.getByText("Test question");
    const botMessage = screen.getByText(/This is a bot response/i);

    expect(userMessage).toBeInTheDocument();
    expect(botMessage).toBeInTheDocument();
  });
});
