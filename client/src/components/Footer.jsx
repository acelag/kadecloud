// App-wide footer (currently mounted only in the admin dashboard). Transparent
// background so it inherits the page theme and stays legible on light/dark.
//
// __BUILD_TIME__ is injected by Vite at build time (see vite.config.js). On
// Render the build runs on deploy, so it reflects the last deployed time. The
// ISO string is parsed and shown in the viewer's own locale + timezone.
function Footer() {
  const year = new Date().getFullYear();

  const deployedAt =
    typeof __BUILD_TIME__ !== "undefined" ? new Date(__BUILD_TIME__) : null;
  const deployedLabel =
    deployedAt && !Number.isNaN(deployedAt.getTime())
      ? deployedAt.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short"
        })
      : null;

  return (
    <footer className="border-t border-slate-400/20 px-4 py-5 text-center text-xs text-slate-500">
      <p>© {year} KadeCloud. All rights reserved.</p>
      {deployedLabel ? (
        <p className="mt-1 text-slate-400">Last deployed {deployedLabel}</p>
      ) : null}
    </footer>
  );
}

export default Footer;
