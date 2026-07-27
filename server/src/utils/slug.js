export function createSlug(value) {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "store";
}

export async function createUniqueStoreSlug(client, businessName) {
  const baseSlug = createSlug(businessName).slice(0, 100);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existingStore = await client.query(
      "SELECT id FROM stores WHERE slug = $1 LIMIT 1",
      [slug]
    );

    if (existingStore.rowCount === 0) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}
