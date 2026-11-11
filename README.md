# Accessibility Scan (axe-core, WCAG 2.2 AA)

A GitHub Action that runs [axe-core](https://github.com/dequelabs/axe-core) against one or more live URLs in headless Chromium and writes the failing WCAG 2.1/2.2 A and AA rules to the job summary.

Everything runs inside your runner. No account, no API key, and the page is never sent to a third-party service.

## Usage

```yaml
name: Accessibility
on:
  deployment_status:
  workflow_dispatch:
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: shibley/accessibility-scan-action@v1
        with:
          url: https://example.com https://example.com/pricing
          fail-on: serious   # critical | serious | moderate | minor | none (default)
```

To scan a Vercel/Netlify preview, pass `${{ github.event.deployment_status.target_url }}` as `url`.

## Inputs

| Input | Default | Description |
|---|---|---|
| `url` | (required) | URL to scan. Space-separate several. |
| `fail-on` | `none` | Fail the step if any failing rule has this impact or higher. |
| `wait-ms` | `1500` | Extra wait after `load`, for client-rendered pages. |

Runs on `ubuntu-latest` (including 26.04) and `ubuntu-24.04`.

## Outputs

`violations`, `critical`, `serious` (counts of failing rules) and `report` (path to the JSON report, which you can upload with `actions/upload-artifact`).

## What it does and doesn't catch

Automated rules cover roughly a third to a half of WCAG success criteria: missing alt text, contrast, form labels, link names, ARIA misuse, and so on. Keyboard flow, focus order and screen-reader meaning still need a human. A clean run is not a compliance claim.

## Watching production between deploys

A CI scan only sees the pages you list, at the moment you deploy. Content edits, CMS changes and third-party widgets break accessibility between deploys too. [RatedWithAI](https://ratedwithai.com/?utm_source=github&utm_medium=action-readme&utm_campaign=dist-20261111-gh-action&ref=dist-20261111-gh-action) runs the same axe-core rules on your live site every day and emails you when a page regresses. The first scan is free, and monitoring is $29/month. The job summary links straight to a scan of each URL you checked.

## License

MIT
