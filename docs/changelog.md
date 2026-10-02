# Product changelog

`/changelog` is the public archive for shipped major releases and meaningful improvements. The site footer links to it; release landing pages can link back to it.

To publish an update, add an entry to `src/content/changelog.ts` in the release PR:

- Use a unique, stable `id` for its anchor (for example `/changelog#v2`).
- Set `date` to the actual public release date in `YYYY-MM-DD` format. Entries display newest first automatically.
- Add a title, short summary, user-facing highlights, and `New`, `Improved`, or `Fixed` tags. Version is optional.
- Optionally include an image with descriptive alt text and its actual dimensions.
- Optionally include `landingPage` with the URL and button label. An update without a landing page still displays its full summary and highlights.

Only describe shipped behavior. Keep planned features on the dedicated release page and clearly mark them as coming soon. Add a new landing page to the sitemap when creating one. The changelog's sitemap date follows the newest release entry.

Publishing entries is an editorial step in the release PR; merging unrelated code changes does not generate public release notes automatically.
