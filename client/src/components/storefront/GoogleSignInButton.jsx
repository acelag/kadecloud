import { useEffect, useRef } from "react";

const GIS_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (document.querySelector(`script[src="${GIS_SRC}"]`)) {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error("Google sign-in script failed to load"));
      }, 8000);
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in script failed to load"));
    document.head.appendChild(script);
  });
}

function GoogleSignInButton({ clientId, onCredential, onError }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!clientId) return undefined;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) onCredential(response.credential);
          },
          ux_mode: "popup",
          auto_select: false
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          shape: "rectangular",
          text: "signin_with"
        });
      })
      .catch((err) => {
        if (!cancelled && typeof onError === "function") onError(err);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential, onError]);

  if (!clientId) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Google sign-in is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code>{" "}
        in <code>client/.env</code> and restart the dev server to enable it.
      </div>
    );
  }

  return <div ref={containerRef} className="flex justify-center" />;
}

export default GoogleSignInButton;
