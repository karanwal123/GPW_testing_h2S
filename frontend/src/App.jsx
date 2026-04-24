import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";
import Login from "./Login";
import Chat from "./Chat";
import { LogOut, Sparkles } from "lucide-react";

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
    Cookies.set("session_user", username, { expires: 1 });
    setUser(username);
  };

  const handleLogout = () => {
    Cookies.remove("session_user");
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-[#F8F8F7] flex flex-col font-sans text-slate-800 relative overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:left-4 focus:top-4 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:shadow-lg"
      >
        Skip to content
      </a>
      {/* Subtle background gradient orbs */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden z-0"
        aria-hidden="true"
      >
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-100/30 rounded-full blur-3xl"></div>
      </div>

      {/* Top bar */}
      {user && (
        <header
          className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
          role="banner"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center space-x-2.5 pointer-events-auto">
              <div className="h-9 w-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
                <Sparkles size={16} className="text-white" />
              </div>
              {/* <span className="text-lg font-bold text-slate-800 tracking-tight">
                BharatBot
              </span> */}
              {/* <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Beta
              </span> */}
            </div>

            {/* User pill */}
            <div className="pointer-events-auto flex items-center space-x-2 glass px-3 py-1.5 rounded-full border border-slate-200/60 shadow-sm">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
                <span className="text-[11px] font-bold text-white">
                  {userInitial}
                </span>
              </div>
              <span className="text-sm font-medium text-slate-600 hidden sm:block">
                {displayName}
              </span>
              <div className="w-px h-4 bg-slate-200"></div>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-slate-700 transition-colors p-0.5"
                title="Logout"
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
        className="flex-1 w-full h-screen flex flex-col relative z-10"
        tabIndex="-1"
      >
        {!user ? (
          <div className="flex-1 flex items-center justify-center p-4">
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
