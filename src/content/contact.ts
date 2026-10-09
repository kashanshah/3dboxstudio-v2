export const CONTACT_PAGE_TITLE = "Contact 3D Box Studio";
export const CONTACT_PAGE_DESCRIPTION =
  "Get in touch about 3D Box Studio—questions, feedback, bug reports, or commercial use. We read every message and usually reply within a few business days.";

export const CONTACT_TOPICS = [
  { value: "general", label: "General question", hint: "How something in the Studio works." },
  { value: "bug", label: "Bug report", hint: "Something broke or exported wrong." },
  { value: "feature", label: "Feature request", hint: "A box style, tool, or export you need." },
  { value: "business", label: "Business / commercial", hint: "Commercial use, teams, or partnerships." },
  { value: "other", label: "Other", hint: "Anything that does not fit above." },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];
