import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";
import Login from "./Login";
import Chat from "./Chat";
import { LogOut } from "lucide-react";
import { trackLogout } from "./analytics";

function App() {
  const [user, setUser] = useState(null);

  // Keep UI resilient if cookies are missing/empty/corrupted.
  const displayName =
    typeof user === "string" && user.trim() ? user.trim() : "User";
  const userInitial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    const sessionUser = Cookies.get("session_user");
    if (sessionUser) {
      setUser(sessionUser);
    }
  }, []);

  const handleLogin = (username) => {
    Cookies.set("session_user", username, {
      expires: 1,
      sameSite: "Strict",
      secure: window.location.protocol === "https:",
    });
    setUser(username);
  };

  const handleLogout = () => {
    trackLogout();
    Cookies.remove("session_user");
    setUser(null);
  };

  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only app-skip-link"
      >
        Skip to content
      </a>
      {user && (
        <header className="app-header" role="banner">
          <div className="app-header-inner">
            <div className="app-brand">
              <div className="app-brand-mark" aria-hidden="true">
                B
              </div>
              <span className="app-brand-text">BharatBot</span>
            </div>
            <div className="app-user">
              <div className="app-user-initial" aria-hidden="true">
                {userInitial}
              </div>
              <span className="app-user-name">{displayName}</span>
              <button
                onClick={handleLogout}
                className="app-logout"
                aria-label="Log out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>
      )}

      <main
        id="main-content"
        className="app-main"
        tabIndex="-1"
      >
        {!user ? (
          <div className="app-login-wrap">
            <Login onLogin={handleLogin} />
          </div>
        ) : (
          <Chat username={displayName} />
        )}
      </main>
    </div>
  );
}

export default App;
