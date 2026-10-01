<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  exclude-result-prefixes="s xhtml">
  <xsl:output method="html" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>XML Sitemap · 3D Box Studio</title>
        <style>
          * { box-sizing: border-box; }
          :root {
            color-scheme: light;
            --bg: #f6f7fb;
            --surface: #ffffff;
            --text: #111827;
            --muted: #667085;
            --line: #e6e8ef;
            --brand: #2563eb;
            --brand-soft: #eff6ff;
          }
          body {
            margin: 0;
            background: var(--bg);
            color: var(--text);
            font-family: Manrope, Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            line-height: 1.5;
          }
          .shell {
            width: min(1180px, calc(100% - 32px));
            margin: 0 auto;
            padding: 48px 0 64px;
          }
          .hero {
            margin-bottom: 24px;
            padding: 30px;
            border: 1px solid var(--line);
            border-radius: 24px;
            background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
            box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
          }
          .eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            padding: 6px 10px;
            border-radius: 999px;
            background: var(--brand-soft);
            color: var(--brand);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: .08em;
            text-transform: uppercase;
          }
          h1 {
            margin: 0;
            font-size: clamp(30px, 5vw, 52px);
            line-height: 1.04;
            letter-spacing: -0.045em;
          }
          .intro {
            max-width: 760px;
            margin: 14px 0 0;
            color: var(--muted);
            font-size: 16px;
          }
          .summary {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 22px;
          }
          .stat {
            padding: 8px 12px;
            border: 1px solid var(--line);
            border-radius: 12px;
            background: var(--surface);
            color: var(--muted);
            font-size: 13px;
          }
          .stat strong { color: var(--text); }
          .table-card {
            overflow: hidden;
            border: 1px solid var(--line);
            border-radius: 20px;
            background: var(--surface);
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 16px 18px;
            border-bottom: 1px solid var(--line);
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #fafbfc;
            color: #475467;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: .04em;
            text-transform: uppercase;
          }
          tr:last-child td { border-bottom: 0; }
          tr:hover td { background: #fbfdff; }
          a {
            color: var(--brand);
            font-weight: 700;
            text-decoration: none;
            word-break: break-word;
          }
          a:hover { text-decoration: underline; }
          .meta {
            color: var(--muted);
            white-space: nowrap;
          }
          .priority {
            display: inline-flex;
            min-width: 42px;
            justify-content: center;
            padding: 4px 8px;
            border-radius: 999px;
            background: #f2f4f7;
            color: #344054;
            font-size: 12px;
            font-weight: 800;
          }
          .alternates {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 9px;
          }
          .lang {
            display: inline-flex;
            padding: 3px 7px;
            border-radius: 999px;
            background: var(--brand-soft);
            color: var(--brand);
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .footer {
            margin-top: 18px;
            color: var(--muted);
            font-size: 13px;
          }
          @media (max-width: 820px) {
            .shell { width: min(100% - 20px, 1180px); padding-top: 20px; }
            .hero { padding: 22px; border-radius: 18px; }
            .table-card { overflow-x: auto; }
            table { min-width: 760px; }
          }
        </style>
      </head>
      <body>
        <main class="shell">
          <section class="hero">
            <div class="eyebrow">3D Box Studio · XML Sitemap</div>
            <h1>Everything search engines can discover.</h1>
            <p class="intro">
              This is the XML sitemap for 3D Box Studio. It is generated for search engines,
              with a readable interface added for people reviewing the site structure.
            </p>
            <div class="summary">
              <div class="stat"><strong><xsl:value-of select="count(s:urlset/s:url)" /></strong> indexed URLs</div>
              <div class="stat">Includes canonical URLs, update hints, priority and language alternates</div>
            </div>
          </section>

          <section class="table-card">
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Last modified</th>
                  <th>Frequency</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="s:urlset/s:url">
                  <tr>
                    <td>
                      <a href="{s:loc}"><xsl:value-of select="s:loc" /></a>
                      <xsl:if test="xhtml:link">
                        <div class="alternates">
                          <xsl:for-each select="xhtml:link">
                            <span class="lang"><xsl:value-of select="@hreflang" /></span>
                          </xsl:for-each>
                        </div>
                      </xsl:if>
                    </td>
                    <td class="meta">
                      <xsl:choose>
                        <xsl:when test="s:lastmod"><xsl:value-of select="substring(s:lastmod, 1, 10)" /></xsl:when>
                        <xsl:otherwise>—</xsl:otherwise>
                      </xsl:choose>
                    </td>
                    <td class="meta">
                      <xsl:choose>
                        <xsl:when test="s:changefreq"><xsl:value-of select="s:changefreq" /></xsl:when>
                        <xsl:otherwise>—</xsl:otherwise>
                      </xsl:choose>
                    </td>
                    <td><span class="priority"><xsl:value-of select="s:priority" /></span></td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </section>

          <p class="footer">
            Search engines read the XML data directly. The styling above does not change sitemap semantics.
          </p>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
