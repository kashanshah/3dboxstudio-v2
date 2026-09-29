export const PRIVACY_PAGE_TITLE = "Privacy Policy";
export const PRIVACY_PAGE_DESCRIPTION =
  "How 3D Box Studio collects, uses, and protects your information when you use the free online box designer, create an account, save designs, or contact us.";

export const PRIVACY_EFFECTIVE_DATE = "2026-09-01";

export type PrivacySection =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    type: "p",
    text: "This Privacy Policy explains how 3D Box Studio (“we”, “us”, or “our”) handles information when you visit 3dboxstudio.com, use the browser-based studio, create an account, save or share designs, or contact us. By using the site, you agree to this policy.",
  },
  { type: "h2", text: "Who we are" },
  {
    type: "p",
    text: "3D Box Studio is operated by Syed Kashan Ali Shah. The public website is available at 3dboxstudio.com. For privacy questions, use our contact form.",
  },
  { type: "h2", text: "Account and authentication" },
  {
    type: "p",
    text: "If you create an account, we collect your email address and, optionally, a display name. If you sign up with email and password, your password is stored as a one-way hash—we never store it in plain text. If you sign in with Google, we receive basic profile information from Google (such as your email address and name) to create or link your account.",
  },
  { type: "h2", text: "Designs, uploads, and cloud save" },
  {
    type: "p",
    text: "You can use the studio without an account. While you work, design state may remain in your browser session. When you upload face artwork or save to the cloud, we store your box configuration (dimensions, materials, openings, and related settings) and uploaded images. Images are stored in Amazon Web Services (AWS) S3; configuration and project metadata are stored in a PostgreSQL database hosted by Neon.",
  },
  {
    type: "ul",
    items: [
      "Saved designs can be linked to your account when you are signed in.",
      "Anonymous cloud saves may be created when you upload artwork before signing in.",
      "Share and preview links use unique tokens. Opening a shared or preview link may increment a view counter.",
      "Saved shares may expire after a configured retention period (currently up to 90 days unless renewed).",
    ],
  },
  { type: "h2", text: "Contact form" },
  {
    type: "p",
    text: "If you submit our contact form, we collect the information you provide (such as your name, email address, topic, subject, and message). Submissions are stored in our internal systems so we can review and respond. We use Cloudflare Turnstile to help prevent automated spam before a message is sent.",
  },
  { type: "h2", text: "Usage analytics" },
  {
    type: "p",
    text: "We use privacy-oriented analytics to understand how the site is used and to improve the product. Depending on configuration, this may include:",
  },
  {
    type: "ul",
    items: [
      "Vercel Web Analytics — aggregated page views and traffic patterns.",
      "Google Analytics — if enabled, page views and general usage metrics via Google’s analytics service.",
      "Admin routes are excluded from analytics tracking where technically possible.",
    ],
  },
  { type: "h2", text: "Cookies and similar technologies" },
  {
    type: "ul",
    items: [
      "Session cookie (sb_session) — keeps you signed in when you use an account. HttpOnly, secure in production.",
      "Analytics — third-party analytics providers may set their own cookies or use similar technologies when enabled.",
      "Cloudflare Turnstile — a third-party script loads on the contact form to verify that submissions come from a person.",
      "Buy Me a Coffee widget — a third-party script may load when you interact with our support widget.",
    ],
  },
  { type: "h2", text: "Server logs and abuse prevention" },
  {
    type: "p",
    text: "Our servers and hosting provider may log technical data such as IP address, request time, and user agent for security, debugging, and rate limiting (for example, on sign-in, password reset, and contact form submissions). Contact form submissions are also checked with Cloudflare Turnstile to reduce spam and automated abuse.",
  },
  { type: "h2", text: "How we use information" },
  {
    type: "ul",
    items: [
      "Provide, operate, and improve the studio and website.",
      "Authenticate you and maintain your account.",
      "Save, load, and share your designs when you use cloud features.",
      "Send transactional emails (such as email verification and password reset) via Resend.",
      "Respond to contact form messages.",
      "Measure site usage and fix issues.",
      "Protect the service against abuse and unauthorized access.",
    ],
  },
  { type: "h2", text: "Legal bases (EEA/UK visitors)" },
  {
    type: "p",
    text: "If you are in the European Economic Area or United Kingdom, we process personal data where necessary to perform our contract with you (providing the service), based on our legitimate interests (security, analytics, and product improvement), or with your consent where required (for example, non-essential cookies where applicable law requires consent).",
  },
  { type: "h2", text: "How we share information" },
  {
    type: "p",
    text: "We do not sell your personal information. We share data only with service providers that help us run 3D Box Studio, including:",
  },
  {
    type: "ul",
    items: [
      "Vercel — website hosting and analytics.",
      "Amazon Web Services (AWS) — image storage.",
      "Neon — database hosting.",
      "Resend — transactional email delivery.",
      "Google — OAuth sign-in and, when enabled, Google Analytics.",
      "Cloudflare — Turnstile bot protection on the contact form.",
    ],
  },
  {
    type: "p",
    text: "Anyone with a share or preview link you create can view the design exposed by that link. Preview links are read-only; editor links allow loading the design in the studio.",
  },
  { type: "h2", text: "Data retention" },
  {
    type: "ul",
    items: [
      "Account data is kept while your account is active and as needed to provide the service.",
      "Cloud-saved designs and uploaded images are retained according to share expiry settings and operational needs.",
      "Contact form submissions are kept as long as needed to respond and maintain records.",
      "Server logs and analytics are retained for limited periods according to provider defaults and our operational needs.",
    ],
  },
  { type: "h2", text: "Your choices and rights" },
  {
    type: "ul",
    items: [
      "You can use much of the studio without creating an account.",
      "You can update your profile name and email from account settings when signed in.",
      "You can request account deletion or data questions via the contact page.",
      "Depending on where you live, you may have rights to access, correct, delete, or restrict processing of your personal data, or to object to certain processing.",
    ],
  },
  { type: "h2", text: "Security" },
  {
    type: "p",
    text: "We use reasonable technical and organizational measures to protect information, including HTTPS, hashed passwords, HttpOnly session cookies, and access controls on cloud infrastructure. No method of transmission or storage is completely secure.",
  },
  { type: "h2", text: "International transfers" },
  {
    type: "p",
    text: "Our service providers may process data in the United States and other countries. When you use 3D Box Studio, your information may be transferred to jurisdictions with different data-protection laws than your own.",
  },
  { type: "h2", text: "Children’s privacy" },
  {
    type: "p",
    text: "3D Box Studio is not directed at children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided us personal information, please contact us so we can delete it.",
  },
  { type: "h2", text: "Changes to this policy" },
  {
    type: "p",
    text: "We may update this Privacy Policy from time to time. The “Last updated” date at the top of this page will change when we do. Continued use of the site after changes means you accept the updated policy.",
  },
  { type: "h2", text: "Contact us" },
  {
    type: "p",
    text: "Questions about this Privacy Policy or your data? Visit the contact page on 3dboxstudio.com or use the contact form there.",
  },
];
