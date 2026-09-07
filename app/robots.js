const SITE_URL = "https://firstfinder.app";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
