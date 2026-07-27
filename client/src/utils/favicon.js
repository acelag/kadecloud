// Point the browser tab's favicon at `url`. No-op for a falsy url so callers
// can pass an optional store favicon without guarding.
export function setFavicon(url) {
  if (!url) return;
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}
