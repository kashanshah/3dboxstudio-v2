export const TERMS_PAGE_TITLE = "Terms of Service";
export const TERMS_PAGE_DESCRIPTION =
  "Terms governing your use of 3D Box Studio—the free browser-based 3D box designer, cloud save, share links, and related website features.";

export const TERMS_EFFECTIVE_DATE = "2026-09-01";

export type TermsSection =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

export const TERMS_SECTIONS: TermsSection[] = [
  {
    type: "p",
    text: "These Terms of Service (“Terms”) govern your access to and use of 3D Box Studio at 3dboxstudio.com, including the browser-based studio, cloud save, share and preview links, and related features (collectively, the “Service”). By using the Service, you agree to these Terms and to our Privacy Policy.",
  },
  { type: "h2", text: "Who operates the Service" },
  {
    type: "p",
    text: "The Service is operated by Syed Kashan Ali Shah (“we”, “us”, or “our”). Questions about these Terms can be sent through our contact page.",
  },
  { type: "h2", text: "The Service" },
  {
    type: "p",
    text: "3D Box Studio is a free online tool for previewing folding cartons and mailer-style packaging in 3D. It is intended for visual mockups, client presentations, and design review—not for engineering production die-lines, color proofs, or manufacturing specifications.",
  },
  {
    type: "ul",
    items: [
      "You may use much of the studio without creating an account.",
      "Signed-in users can save designs to the cloud, rename projects, and create share or preview links.",
      "Exports include viewport PNG images, optional MP4 recordings, and JSON project files as described in the studio.",
      "Features may change, be added, or be removed at any time.",
    ],
  },
  { type: "h2", text: "Eligibility" },
  {
    type: "p",
    text: "You must be at least 13 years old to use the Service. If you are under the age of majority where you live, you may use the Service only with permission from a parent or legal guardian. You represent that the information you provide is accurate and that you have the right to use any content you upload.",
  },
  { type: "h2", text: "Accounts" },
  {
    type: "ul",
    items: [
      "You are responsible for activity under your account and for keeping your credentials secure.",
      "You must provide a valid email address and complete verification when required.",
      "You may sign in with email and password or with Google, where available.",
      "We may suspend or terminate accounts that violate these Terms or that pose a security or abuse risk.",
    ],
  },
  { type: "h2", text: "Your content and designs" },
  {
    type: "p",
    text: "You retain ownership of artwork, logos, and other materials you upload, and of the mockups and exports you create, subject to any third-party rights in your source files. You are solely responsible for ensuring you have the rights to use uploaded content, including for commercial projects.",
  },
  {
    type: "p",
    text: "To operate the Service, you grant us a non-exclusive, worldwide license to host, store, process, display, and transmit your designs and uploads only as needed to provide cloud save, sharing, previews, backups, and related functionality. That license ends when your content is deleted from our systems, except where retention is required by law or reasonable backup cycles.",
  },
  { type: "h2", text: "Share and preview links" },
  {
    type: "ul",
    items: [
      "Anyone with a link you create may be able to access the design exposed by that link.",
      "Preview links are read-only; editor links allow loading the design in the studio.",
      "You are responsible for how and with whom you share links.",
      "Saved shares may expire after a limited retention period.",
      "View counts may be recorded when shared or preview links are opened.",
    ],
  },
  { type: "h2", text: "Acceptable use" },
  {
    type: "p",
    text: "You agree not to misuse the Service. For example, you must not:",
  },
  {
    type: "ul",
    items: [
      "Upload content that infringes intellectual property or other rights, or that is unlawful, harmful, or deceptive.",
      "Attempt to gain unauthorized access to accounts, systems, or data.",
      "Interfere with or disrupt the Service, including through automated scraping, excessive requests, or abuse of rate limits.",
      "Reverse engineer or copy the Service except where permitted by law.",
      "Use the Service in a way that violates applicable law or third-party terms (including Google sign-in or hosting provider policies).",
    ],
  },
  { type: "h2", text: "Commercial use of exports" },
  {
    type: "p",
    text: "You may use PNG, MP4, and similar exports from your own designs in client work, marketing, e-commerce listings, and presentations, provided you have the necessary rights to the underlying artwork. We do not claim ownership over your exports.",
  },
  { type: "h2", text: "Our intellectual property" },
  {
    type: "p",
    text: "The Service, including its software, branding, site design, and documentation, is owned by us or our licensors and is protected by intellectual property laws. These Terms do not grant you any right to use our trademarks, logos, or branding except as needed to use the Service in its intended form.",
  },
  { type: "h2", text: "Third-party services" },
  {
    type: "p",
    text: "The Service relies on third-party providers for hosting, storage, email, authentication, analytics, and other functions. Your use of those features may also be subject to the third parties’ terms and privacy practices, as described in our Privacy Policy.",
  },
  { type: "h2", text: "Disclaimer of warranties" },
  {
    type: "p",
    text: "THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR THAT ON-SCREEN COLORS OR DIMENSIONS WILL MATCH PHYSICAL PRINT OR MANUFACTURING OUTPUT.",
  },
  { type: "h2", text: "Limitation of liability" },
  {
    type: "p",
    text: "TO THE FULLEST EXTENT PERMITTED BY LAW, WE AND OUR OPERATORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS OPPORTUNITY, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM OR (B) USD $100. SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS, SO SOME OF THE ABOVE MAY NOT APPLY TO YOU.",
  },
  { type: "h2", text: "Indemnity" },
  {
    type: "p",
    text: "You agree to defend, indemnify, and hold harmless us and our operators from claims, damages, losses, and expenses (including reasonable legal fees) arising from your content, your use of the Service, or your violation of these Terms or applicable law.",
  },
  { type: "h2", text: "Termination" },
  {
    type: "p",
    text: "You may stop using the Service at any time. We may suspend or terminate access to the Service, or remove content, if we reasonably believe you have violated these Terms, created risk or legal exposure, or if we discontinue the Service. Provisions that by their nature should survive termination will survive, including ownership, disclaimers, limitations of liability, and indemnity.",
  },
  { type: "h2", text: "Changes to these Terms" },
  {
    type: "p",
    text: "We may update these Terms from time to time. When we do, we will revise the “Last updated” date on this page. Continued use of the Service after changes become effective constitutes acceptance of the updated Terms.",
  },
  { type: "h2", text: "Governing law" },
  {
    type: "p",
    text: "These Terms are governed by the laws of the United States and the State of Delaware, without regard to conflict-of-law rules, except where mandatory local law provides otherwise.",
  },
  { type: "h2", text: "Contact" },
  {
    type: "p",
    text: "For questions about these Terms, contact us through the contact page on 3dboxstudio.com.",
  },
];
