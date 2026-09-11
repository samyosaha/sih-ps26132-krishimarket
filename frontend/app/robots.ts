import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://krishimarket.in";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/farmer/", "/buyer/", "/transactions", "/disputes"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
