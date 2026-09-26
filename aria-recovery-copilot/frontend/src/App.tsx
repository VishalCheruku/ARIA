import ChatPage from "./pages/ChatPage";

/**
 * The Copilot SPA has exactly one real page: /chat (spec §6.2). It is mounted
 * under the Vite base path — "/" standalone, "/copilot/" embedded inside the
 * main ARIA app — so the check is base-aware. A missing/expired token renders
 * the friendly invalid-link state inside ChatPage.
 */
export default function App() {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const chatPath = `${base}chat`;
  const current = window.location.pathname;

  if (current !== chatPath && !current.endsWith("/chat")) {
    window.location.replace(`${chatPath}${window.location.search}`);
    return null;
  }
  return <ChatPage />;
}
