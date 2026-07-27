// App-wide footer. Transparent background so it inherits the page's theme
// (dark login/marketing, light dashboard, light storefront) and stays legible
// on all of them.
function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-400/20 px-4 py-5 text-center text-xs text-slate-500">
      © {year} KadeCloud. All rights reserved.
    </footer>
  );
}

export default Footer;
