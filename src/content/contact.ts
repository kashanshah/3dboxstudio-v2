export const CONTACT_PAGE_TITLE = "Contact 3D Box Studio";
export const CONTACT_PAGE_DESCRIPTION =
  "Get in touch about 3D Box Studio—questions, feedback, bug reports, or commercial use. We read every message and usually reply within a few business days.";

export const CONTACT_TOPICS = [
  { value: "general", label: "General question" },
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "business", label: "Business / commercial" },
  { value: "other", label: "Other" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];
