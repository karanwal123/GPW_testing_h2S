/**
 * Google Analytics Setup for BharatBot
 * Tracks user interactions and system events for performance monitoring
 */

export function initializeAnalytics() {
  const measurementId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;

  if (!measurementId) {
    console.warn("⚠️  VITE_GOOGLE_ANALYTICS_ID not set. Analytics disabled.");
    return;
  }

  // Load Google Analytics script
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("js", new Date());

  // Configure measurement
  gtag("config", measurementId, {
    page_path: window.location.pathname,
    anonymize_ip: true,
  });

  console.log("✅ Google Analytics initialized");
}

/**
 * Track custom events
 * @param {string} eventName - Event name (e.g., 'chat_message_sent')
 * @param {Object} eventParams - Event parameters
 */
export function trackEvent(eventName, eventParams = {}) {
  if (typeof window.gtag !== "function") {
    console.warn("Google Analytics not initialized");
    return;
  }

  window.gtag("event", eventName, {
    timestamp: new Date().toISOString(),
    ...eventParams,
  });
}

/**
 * Track page view
 * @param {string} pageName - Name of the page
 * @param {string} pageTitle - Title of the page
 */
export function trackPageView(pageName, pageTitle = "") {
  if (typeof window.gtag !== "function") return;

  window.gtag("config", import.meta.env.VITE_GOOGLE_ANALYTICS_ID, {
    page_path: pageName,
    page_title: pageTitle,
  });
}

// Pre-defined event tracking functions for common actions

export function trackChatMessageSent(intent, messageLength, sessionId) {
  trackEvent("chat_message_sent", {
    intent: intent || "unknown",
    message_length: messageLength || 0,
    session_id: sessionId || "unknown",
    source: "frontend",
  });
}

export function trackChatResponseReceived(intent, responseTime) {
  trackEvent("chat_response_received", {
    intent: intent || "unknown",
    response_time_ms: responseTime || 0,
    timestamp: new Date().toISOString(),
  });
}

export function trackBoothSearch(address, resultsFound) {
  trackEvent("booth_search", {
    address: address || "unknown",
    results_found: resultsFound || 0,
    source: "frontend",
  });
}

export function trackLogin(username) {
  trackEvent("user_login", {
    username: username || "unknown",
    timestamp: new Date().toISOString(),
  });
}

export function trackLogout() {
  trackEvent("user_logout", {
    timestamp: new Date().toISOString(),
  });
}

export function trackError(errorMessage, errorType = "frontend") {
  trackEvent("error_occurred", {
    error_message: errorMessage || "unknown",
    error_type: errorType,
    timestamp: new Date().toISOString(),
    user_agent: navigator.userAgent,
  });
}

export function trackAPIError(endpoint, statusCode, errorMessage) {
  trackEvent("api_error", {
    endpoint: endpoint || "unknown",
    status_code: statusCode || 0,
    error_message: errorMessage || "unknown",
    timestamp: new Date().toISOString(),
  });
}
