import type { BlogFaq, BlogSection } from "@/content/blogPosts";

/** Localized fields for a blog post. Metadata dates/slug stay from the English source. */
export type BlogPostTranslation = {
  title: string;
  seoTitle?: string;
  description: string;
  imageAlt?: string;
  keywords?: string[];
  faqs?: BlogFaq[];
  sections: BlogSection[];
};

export type BlogLocaleCatalog = Record<string, BlogPostTranslation>;
