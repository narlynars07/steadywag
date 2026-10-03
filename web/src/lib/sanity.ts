import { createClient } from "next-sanity";

/**
 * Read-only client for the public Steadywag dataset. No token is needed: the dataset is public
 * and contains only de-identified records. Writes never happen from the web app.
 */
export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "yahsq70q",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: "2026-10-01",
  useCdn: false,
});

export function sanityFetch<T>(query: string, params: Record<string, unknown> = {}): Promise<T> {
  return client.fetch<T>(query, params);
}
