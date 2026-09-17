# DNS Tools

DNS lookup, Standard Records, common port check, and domain info tool.

Deploy command:

```bash
npx wrangler deploy
```

No database, R2 bucket, or bindings are required.

Build 9 fixes the crt.sh request to use Cloudflare Workers' supported manual
redirect mode. Non-success responses, including redirects, are reported
explicitly while keeping completed DNS results available.
Company branding is removed from the page and reports.
Standard Records checks A and CNAME
for 49 hostnames, including connect, all 45 requested names, and the existing
autodiscover, autoconfig, and owa entries. Root records, DMARC, and DKIM
selector checks remain included.

The 111 standard DNS checks run automatically across three API requests, at most
40 DNS queries per request and six concurrent queries. The results are
combined into the existing text report. Unresolved checks and empty record
sections are hidden.

Standard Records also searches crt.sh certificate history automatically.
Discovered hostnames are deduplicated and scoped to the entered domain, then
checked for current A, AAAA and CNAME records. Already-completed checks are
not repeated. Additional answers are marked [crt.sh] in the same report.
Wildcard certificates are not expanded into guessed hostnames.

Certificate history is not a complete inventory of DNS records. Old certificate
names without current DNS answers are hidden. A crt.sh failure leaves standard
results visible with a short status message. The provider request times out
after 15 seconds and has an 8 MiB response cap; discovery checks at most 1,000
unique hostnames, with an explicit note when that hostname limit is reached.
Additional DNS checks run in batches of at most 40, with six at a time.

Upload the ZIP contents to your existing DNS repository and commit.
Leave the Build command empty; keep the Deploy command above.
The page will read DNS Tools with Build 9 beneath it.

Run the mocked DNS and browser-script checks with: node test.mjs
