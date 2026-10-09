# Google sign-in asset

The sign-in and sign-up pages render `GoogleSignInButton` (`src/components/auth/google-sign-in-button.tsx`) as an HTML button following Google's light-theme spec: white fill, `#747775` 1px stroke, `#1F1F1F` label, the standard multi-colour "G" mark (inline SVG, unmodified), and the approved label "Continue with Google". It is full width so it lines up with the other primary buttons on the form.

Branding guidance: https://developers.google.com/identity/branding-guidelines

Do not recolour or distort the "G" mark. Authentication continues through the existing server OAuth flow, with a safe internal return path.

`google-signin-light.png` is the unmodified pre-approved Android + Web light, text, square button at 3× resolution (540×120), from Google's May 2026 asset bundle (https://developers.google.com/static/identity/images/signin-assets.zip, path `Android + Web/PNG @3x/Light/Theme=Light, Show text=Yes, Shape=Square, Platform=Android+Web@3x.png`). It is no longer used by the component and is kept for reference.
