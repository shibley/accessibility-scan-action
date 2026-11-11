// Runs axe-core (WCAG 2.0/2.1/2.2 A + AA tags) against each URL in headless Chromium,
// entirely inside the runner. Writes a job summary, a JSON report and step outputs.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IMPACTS = ['minor', 'moderate', 'serious', 'critical'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const REF = 'dist-20261111-gh-action';

const urls = (process.env.A11Y_URLS || '').split(/\s+/).filter(Boolean);
const failOn = (process.env.A11Y_FAIL_ON || 'none').toLowerCase();
const waitMs = Number(process.env.A11Y_WAIT_MS || 1500);
if (!urls.length) { console.error('::error::input "url" is required'); process.exit(1); }
if (failOn !== 'none' && !IMPACTS.includes(failOn)) {
  console.error(`::error::fail-on must be one of none, ${IMPACTS.join(', ')}`); process.exit(1);
}

export function monitorLink(url) {
  const q = new URLSearchParams({ url, utm_source: 'github', utm_medium: 'action', utm_campaign: REF, ref: REF });
  return `https://ratedwithai.com/scan?${q}`;
}

const browser = await chromium.launch();
const results = [];
try {
  for (const url of urls) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(waitMs);
      const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      results.push({ url, passes: r.passes.length, violations: r.violations.map(v => ({
        id: v.id, impact: v.impact || 'minor', help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.length,
      })) });
    } catch (e) {
      results.push({ url, error: String(e.message || e).split('\n')[0] });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }

const all = results.flatMap(r => r.violations || []);
const count = imp => all.filter(v => v.impact === imp).length;
const esc = s => String(s).replace(/\|/g, '\\|');

let md = '## Accessibility scan (axe-core, WCAG 2.2 AA)\n\n';
for (const r of results) {
  md += `### ${r.url}\n\n`;
  if (r.error) { md += `Could not scan: ${esc(r.error)}\n\n`; continue; }
  if (!r.violations.length) { md += `No automated WCAG A/AA failures (${r.passes} rules passed).\n\n`; }
  else {
    md += `${r.violations.length} failing rules, ${r.passes} passing.\n\n| Impact | Rule | Elements |\n|---|---|---|\n`;
    const sorted = [...r.violations].sort((a, b) => IMPACTS.indexOf(b.impact) - IMPACTS.indexOf(a.impact));
    for (const v of sorted) md += `| ${v.impact} | [${esc(v.help)}](${v.helpUrl}) (\`${v.id}\`) | ${v.nodes} |\n`;
    md += '\n';
  }
  md += `Automated checks catch part of WCAG, not all of it. To re-check this page every day and get an email when a fix regresses: [RatedWithAI monitoring](${monitorLink(r.url)}).\n\n`;
}

const out = process.env.RUNNER_TEMP || process.cwd();
const report = join(out, 'a11y-report.json');
writeFileSync(report, JSON.stringify(results, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
else console.log(md);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT,
    `violations=${all.length}\ncritical=${count('critical')}\nserious=${count('serious')}\nreport=${report}\n`);
}
for (const v of all) console.log(`${v.impact.padEnd(8)} ${v.id} (${v.nodes} elements)`);

const errored = results.filter(r => r.error);
if (errored.length === results.length) { console.error('::error::no URL could be scanned'); process.exit(1); }
if (failOn !== 'none') {
  const bad = all.filter(v => IMPACTS.indexOf(v.impact) >= IMPACTS.indexOf(failOn));
  if (bad.length) { console.error(`::error::${bad.length} failing rules at or above "${failOn}" impact`); process.exit(1); }
}
