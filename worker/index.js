import { connect } from "cloudflare:sockets";

const DNS_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const RDAP_BOOTSTRAP_ENDPOINT = "https://data.iana.org/rdap/dns.json";
const CRT_ENDPOINT = "https://crt.sh/";
const MAX_CERTIFICATE_NAMES = 1000;

const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"];

const STANDARD_HOSTS = [
  "www",
  "mail",
  "autodiscover",
  "autoconfig",
  "smtp",
  "imap",
  "pop",
  "vpn",
  "remote",
  "portal",
  "owa",
  "webmail",
  "connect",
  "ftp",
  "web",
  "cpanel",
  "m",
  "test",
  "blog",
  "pop3",
  "dev",
  "secure",
  "api",
  "admin",
  "whm",
  "forum",
  "app",
  "shop",
  "store",
  "support",
  "server",
  "news",
  "staging",
  "host",
  "beta",
  "crm",
  "en",
  "mx1",
  "sso",
  "status",
  "billing",
  "docs",
  "chat",
  "video",
  "cloud",
  "sql",
  "login",
  "uat",
  "db",
];

const DKIM_SELECTORS = ["selector1", "selector2", "google", "default"];

const COMMON_PORTS = [
  [20, "FTP data"],
  [21, "FTP"],
  [22, "SSH"],
  [23, "Telnet"],
  [25, "SMTP, blocked by Cloudflare"],
  [53, "DNS"],
  [80, "HTTP"],
  [110, "POP3"],
  [143, "IMAP"],
  [443, "HTTPS"],
  [465, "SMTPS"],
  [587, "SMTP submit"],
  [993, "IMAPS"],
  [995, "POP3S"],
  [1433, "SQL Server"],
  [3306, "MySQL"],
  [3389, "RDP"],
  [5432, "PostgreSQL"],
  [5900, "VNC"],
  [8080, "HTTP alt"],
  [8443, "HTTPS alt"],
];

const TYPE_CODES = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  CAA: 257,
};

const STATUS_TEXT = {
  0: "NOERROR",
  1: "FORMERR",
  2: "SERVFAIL",
  3: "NXDOMAIN",
  4: "NOTIMP",
  5: "REFUSED",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeName(value) {
  let name = String(value || "").trim().toLowerCase();
  name = name.replace(/^https?:\/\//, "");
  name = name.split("/")[0] || name;
  name = name.replace(/^\.+|\.+$/g, "");

  if (!name || name.length > 253) return "";
  if (!/^[a-z0-9._-]+$/.test(name)) return "";
  if (!name.includes(".")) return "";

  return name;
}

function normalizeType(value) {
  const type = String(value || "A").trim().toUpperCase();
  return TYPE_CODES[type] ? type : "A";
}

function textRecords(records) {
  return records
    .filter((record) => record.type === TYPE_CODES.TXT)
    .map((record) => String(record.data || "").replace(/^"|"$/g, "").replaceAll('" "', ""));
}

function summarizeMail(domain, results) {
  const mx = results.MX?.Answer || [];
  const txt = textRecords(results.TXT?.Answer || []);
  const dmarcTxt = textRecords(results.DMARC?.Answer || []);
  const spf = txt.filter((record) => record.toLowerCase().startsWith("v=spf1"));
  const dmarc = dmarcTxt.find((record) => record.toLowerCase().startsWith("v=dmarc1"));
  const mxSummary = mx.length ? `${mx.length} MX record${mx.length === 1 ? "" : "s"} found` : "No MX records found";
  const spfSummary = spf.length === 1 ? "SPF found" : spf.length > 1 ? "Multiple SPF records found" : "No SPF record found";
  let dmarcSummary = "No DMARC record found";

  if (dmarc) {
    const policy = dmarc.match(/;\s*p=([^;\s]+)/i)?.[1] || "unknown";
    dmarcSummary = `DMARC found, policy is ${policy}`;
  }

  const warnings = [];
  if (!mx.length) warnings.push("No MX records. This domain may not receive mail.");
  if (!spf.length) warnings.push("No SPF record.");
  if (spf.length > 1) warnings.push("More than one SPF record. That can break SPF.");
  if (!dmarc) warnings.push("No DMARC record.");
  if (dmarc && /;\s*p=none/i.test(dmarc)) warnings.push("DMARC policy is p=none.");

  return {
    domain,
    mx: mxSummary,
    spf: spfSummary,
    dmarc: dmarcSummary,
    warnings,
    records: {
      mx: mx.map((record) => record.data),
      spf,
      dmarc: dmarc ? [dmarc] : [],
    },
  };
}

function answerValues(response) {
  return (response.Answer || []).map((record) => ({
    ttl: record.TTL || 0,
    value: record.data || "",
  }));
}

async function safeLookup(name, type) {
  try {
    const response = await lookupDns(name, type);
    return {
      status: response.StatusText,
      answers: answerValues(response),
    };
  } catch (error) {
    return {
      status: "ERROR",
      answers: [],
      error: error.message || "Lookup failed.",
    };
  }
}

async function runDnsTasks(batch) {
  const checks = new Array(batch.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, batch.length) }, async () => {
    while (next < batch.length) {
      const index = next++;
      const task = batch[index];
      checks[index] = { ...task, ...(await safeLookup(task.name, task.type)) };
    }
  }));
  return checks;
}

function isDomainHostname(name, domain) {
  return typeof name === "string" && name.length <= 253 &&
    (name === domain || name.endsWith("." + domain)) &&
    name.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function certificateNames(rows, domain) {
  if (!Array.isArray(rows)) throw new Error("crt.sh returned an unexpected response.");
  const names = new Set();
  let limited = false;
  for (const row of rows) {
    // A wildcard certificate does not identify a concrete host: never guess one.
    for (const field of [row?.name_value, row?.common_name]) {
      if (typeof field !== "string") continue;
      for (const value of field.split(/\r?\n/)) {
        const name = value.trim().toLowerCase().replace(/\.$/, "");
        if (!isDomainHostname(name, domain) || names.has(name)) continue;
        if (names.size >= MAX_CERTIFICATE_NAMES) { limited = true; continue; }
        names.add(name);
      }
    }
  }
  return { names: [...names].sort(), limited };
}

async function discoverCertificateNames(domain) {
  if (!isDomainHostname(domain, domain)) throw new Error("Enter a domain hostname for crt.sh.");
  const url = new URL(CRT_ENDPOINT);
  url.searchParams.set("q", "%." + domain);
  url.searchParams.set("output", "json");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      redirect: "manual",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("crt.sh returned HTTP " + response.status + ".");
    }
    // Bound external input before JSON parsing on the Worker.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0, text = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("crt.sh response is too large for this lookup.");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    const result = certificateNames(JSON.parse(text), domain);
    return { domain, ...result, source: "crt.sh" };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("crt.sh timed out. Standard Records are still available.");
    if (error instanceof SyntaxError) throw new Error("crt.sh did not return valid JSON.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function standardScan(domain, offset = 0) {
  const tasks = [
    ...DNS_TYPES.map(type => ({ name: domain, type })),
    ...STANDARD_HOSTS.flatMap(host => ["A", "CNAME"].map(type => ({ name: `${host}.${domain}`, type }))),
    { name: `_dmarc.${domain}`, type: "TXT" },
    ...DKIM_SELECTORS.map(selector => ({ name: `${selector}._domainkey.${domain}`, type: "TXT" })),
  ];
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= tasks.length) {
    throw new Error("Invalid Standard Records offset.");
  }
  // Each browser request stays below the Free plan's 50-subrequest ceiling.
  const batch = tasks.slice(offset, offset + 40);
  const checks = await runDnsTasks(batch);
  return {
    domain,
    checked: checks.length,
    found: checks.filter(check => check.answers.length).length,
    checks,
    total: tasks.length,
    nextOffset: offset + batch.length < tasks.length ? offset + batch.length : null,
  };
}

function findEntityName(entities = [], role) {
  const entity = entities.find((item) => (item.roles || []).includes(role));
  const vcard = entity?.vcardArray?.[1] || [];
  const org = vcard.find((item) => item[0] === "org")?.[3];
  const fn = vcard.find((item) => item[0] === "fn")?.[3];
  return Array.isArray(org) ? org.filter(Boolean).join(" ") : org || fn || "";
}

function findEvent(events = [], action) {
  return events.find((event) => event.eventAction === action)?.eventDate || "";
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/rdap+json, application/json",
      "user-agent": "DNSTools/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function rdapLookup(domain) {
  const tld = domain.split(".").pop();
  const errors = [];

  try {
    const bootstrap = await fetchJson(RDAP_BOOTSTRAP_ENDPOINT);
    const service = (bootstrap.services || []).find(([tlds]) => tlds.includes(tld));

    if (service) {
      for (const baseUrl of service[1]) {
        try {
          return await fetchJson(`${baseUrl.replace(/\/$/, "")}/domain/${encodeURIComponent(domain)}`);
        } catch (error) {
          errors.push(`${baseUrl}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    errors.push(`IANA bootstrap: ${error.message}`);
  }

  const fallbackUrls = [
    `https://rdap.verisign.com/${encodeURIComponent(tld)}/v1/domain/${encodeURIComponent(domain)}`,
    `https://rdap.publicinterestregistry.org/rdap/domain/${encodeURIComponent(domain)}`,
  ];

  for (const url of fallbackUrls) {
    try {
      return await fetchJson(url);
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  return { error: errors.join("; ") || "RDAP lookup failed." };
}

async function domainInfo(domain) {
  const [rdapResult, ds, dnskey, ns] = await Promise.all([
    rdapLookup(domain),
    safeLookup(domain, "DS"),
    safeLookup(domain, "DNSKEY"),
    safeLookup(domain, "NS"),
  ]);

  const rdapNameservers = (rdapResult.nameservers || [])
    .map((server) => server.ldhName || server.unicodeName)
    .filter(Boolean);
  const dnsNameservers = ns.answers.map((answer) => answer.value.replace(/\.$/, ""));
  const nameservers = rdapNameservers.length ? rdapNameservers : dnsNameservers;

  const registrar = findEntityName(rdapResult.entities || [], "registrar");
  const registrant = findEntityName(rdapResult.entities || [], "registrant");
  const dsValues = ds.answers.map((answer) => answer.value);
  const dnskeyValues = dnskey.answers.map((answer) => answer.value);

  return {
    domain,
    registrar: registrar || "Unknown",
    registrant: registrant || "Redacted or unavailable",
    created: findEvent(rdapResult.events || [], "registration") || "Unknown",
    updated: findEvent(rdapResult.events || [], "last changed") || "Unknown",
    expires: findEvent(rdapResult.events || [], "expiration") || "Unknown",
    status: rdapResult.status || [],
    nameservers,
    dnssec: dsValues.length ? "DS record found" : dnskeyValues.length ? "DNSKEY found, no DS seen" : "No DS/DNSKEY records found",
    ds: dsValues,
    dnskeyCount: dnskeyValues.length,
    rdapError: rdapResult.error || "",
  };
}

function isPrivateTarget(domain) {
  return (
    domain === "localhost" ||
    domain.endsWith(".local") ||
    /^10\./.test(domain) ||
    /^127\./.test(domain) ||
    /^169\.254\./.test(domain) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(domain) ||
    /^192\.168\./.test(domain)
  );
}

async function checkPort(hostname, port, label) {
  if (port === 25) {
    return { port, label, status: "SKIPPED", detail: "Cloudflare Workers block outbound TCP 25.", ms: 0 };
  }

  const started = Date.now();
  let timeoutId;

  try {
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timed out")), 2800);
    });
    const socket = connect({ hostname, port });
    await Promise.race([socket.opened, timeout]);
    socket.close();
    clearTimeout(timeoutId);
    return { port, label, status: "OPEN", detail: "TCP connect succeeded", ms: Date.now() - started };
  } catch (error) {
    clearTimeout(timeoutId);
    return { port, label, status: "CLOSED", detail: error.message || "TCP connect failed", ms: Date.now() - started };
  }
}

async function commonPortScan(domain) {
  if (isPrivateTarget(domain)) {
    throw new Error("Private and localhost targets are not supported from Cloudflare.");
  }

  const results = [];
  const batchSize = 5;

  for (let index = 0; index < COMMON_PORTS.length; index += batchSize) {
    const batch = COMMON_PORTS.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(([port, label]) => checkPort(domain, port, label)))));
  }

  return {
    domain,
    checked: results.length,
    open: results.filter((result) => result.status === "OPEN").length,
    results,
  };
}

async function lookupDns(name, type) {
  const query = new URL(DNS_ENDPOINT);
  query.searchParams.set("name", name);
  query.searchParams.set("type", type);

  const response = await fetch(query, {
    headers: {
      accept: "application/dns-json",
      "user-agent": "DNSTools/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`DNS lookup failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  data.StatusText = STATUS_TEXT[data.Status] || `Code ${data.Status}`;
  return data;
}

async function apiResponse(request) {
  const url = new URL(request.url);
  const domain = normalizeName(url.searchParams.get("name"));
  const mode = String(url.searchParams.get("mode") || "single").toLowerCase();
  const type = normalizeType(url.searchParams.get("type"));

  if (!domain) {
    return Response.json({ error: "Enter a valid domain name." }, { status: 400 });
  }

  try {
    if (mode === "all") {
      const entries = await Promise.all(
        DNS_TYPES.map(async (recordType) => [recordType, await lookupDns(domain, recordType)])
      );
      return Response.json(Object.fromEntries(entries), { headers: noStoreHeaders("application/json") });
    }

    if (mode === "mail") {
      const [mx, txt, dmarc] = await Promise.all([
        lookupDns(domain, "MX"),
        lookupDns(domain, "TXT"),
        lookupDns(`_dmarc.${domain}`, "TXT"),
      ]);

      return Response.json(
        summarizeMail(domain, { MX: mx, TXT: txt, DMARC: dmarc }),
        { headers: noStoreHeaders("application/json") }
      );
    }

    if (mode === "audit") {
      const offset = Number(url.searchParams.get("offset") || 0);
      return Response.json(await standardScan(domain, offset), { headers: noStoreHeaders("application/json") });
    }

    if (mode === "crt") {
      return Response.json(await discoverCertificateNames(domain), { headers: noStoreHeaders("application/json") });
    }

    if (mode === "crt-records") {
      if (request.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });
      const tasks = (await request.json()).tasks;
      if (!Array.isArray(tasks) || !tasks.length || tasks.length > 40 ||
          !tasks.every(task => task && isDomainHostname(task.name, domain) &&
            ["A", "AAAA", "CNAME"].includes(task.type))) {
        return Response.json({ error: "Invalid certificate DNS checks." }, { status: 400 });
      }
      const unique = [...new Map(tasks.map(task =>
        [task.name + "|" + task.type, { name: task.name, type: task.type, source: "crt.sh" }]
      )).values()];
      const checks = await runDnsTasks(unique);
      return Response.json({ checks }, { headers: noStoreHeaders("application/json") });
    }

    if (mode === "domain") {
      return Response.json(await domainInfo(domain), { headers: noStoreHeaders("application/json") });
    }

    if (mode === "ports") {
      return Response.json(await commonPortScan(domain), { headers: noStoreHeaders("application/json") });
    }

    return Response.json(await lookupDns(domain, type), { headers: noStoreHeaders("application/json") });
  } catch (error) {
    return Response.json({ error: error.message || "DNS lookup failed." }, { status: 502 });
  }
}

function noStoreHeaders(contentType) {
  return {
    "content-type": `${contentType}; charset=utf-8`,
    "cache-control": "no-store",
  };
}

function pageResponse() {
  const typeOptions = DNS_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DNS Tools</title>
  <meta name="description" content="DNS lookup and mail health checker.">
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #07111d;
      color: #f8fafc;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top right, rgba(34, 211, 238, 0.16), transparent 34rem),
        linear-gradient(180deg, #07111d 0%, #0b1625 100%);
    }
    main {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 20px 0 48px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      border: 1px solid rgba(103, 232, 249, 0.22);
      border-radius: 8px;
      background: #0d1a29;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border: 1px solid rgba(165, 243, 252, 0.72);
      border-radius: 8px;
      background: rgba(34, 211, 238, 0.15);
      color: white;
      font-weight: 900;
      letter-spacing: 0.08em;
      box-shadow: inset 0 0 24px rgba(103, 232, 249, 0.12);
    }
    .brand-title {
      margin: 0;
      font-size: 18px;
      line-height: 1.1;
      font-weight: 900;
    }
    .brand-subtitle {
      margin: 4px 0 0;
      color: rgba(207, 250, 254, 0.82);
      font-size: 14px;
      font-weight: 600;
    }
    .layout {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    .panel {
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.24);
    }
    .side {
      padding: 20px;
    }
    h1 {
      margin: 0;
      font-size: 34px;
      line-height: 1;
    }
    .side p {
      margin: 14px 0 0;
      color: #cbd5e1;
      font-size: 15px;
      line-height: 1.65;
    }
    label {
      display: block;
      margin: 22px 0 8px;
      color: #e0f2fe;
      font-size: 13px;
      font-weight: 900;
    }
    input, select {
      width: 100%;
      min-height: 48px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      padding: 12px;
      background: #080e1d;
      color: #fff;
      font: inherit;
      font-weight: 800;
      outline: none;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 110px;
      gap: 10px;
    }
    .actions {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }
    button {
      min-height: 46px;
      border: 0;
      border-radius: 8px;
      padding: 12px 14px;
      background: #22d3ee;
      color: #06111f;
      cursor: pointer;
      font: inherit;
      font-weight: 900;
    }
    button.secondary {
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(2, 6, 23, 0.35);
      color: #f8fafc;
    }
    .status {
      margin-top: 18px;
      color: #a5f3fc;
      font-size: 13px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }
    .result {
      min-height: 620px;
      overflow: hidden;
    }
    .result-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .result-title {
      margin: 0;
      color: #a5f3fc;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .record-list {
      display: grid;
      gap: 12px;
      max-height: 560px;
      overflow: auto;
      padding: 20px;
    }
    .record {
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(2, 6, 23, 0.35);
    }
    .record-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #93c5fd;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .record-data {
      margin: 10px 0 0;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      color: #f8fafc;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 14px;
      line-height: 1.45;
    }
    .console-output {
      margin: 0;
      min-height: 520px;
      overflow: auto;
      white-space: pre;
      color: #dbeafe;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.55;
    }
    .console-wrap {
      padding: 16px;
      border: 1px solid rgba(103, 232, 249, 0.18);
      border-radius: 8px;
      background: rgba(2, 6, 23, 0.48);
    }
    .empty {
      display: grid;
      place-items: center;
      min-height: 320px;
      border: 1px dashed rgba(148, 163, 184, 0.3);
      border-radius: 8px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.6;
    }
    .summary {
      display: grid;
      gap: 12px;
    }
    .pill {
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(2, 6, 23, 0.35);
    }
    .pill strong {
      display: block;
      color: #f8fafc;
      overflow-wrap: anywhere;
    }
    .pill span {
      display: block;
      margin-top: 5px;
      color: #94a3b8;
      font-size: 13px;
    }
    .warning {
      border-color: rgba(251, 191, 36, 0.45);
      color: #fde68a;
    }
    @media (max-width: 880px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .row {
        grid-template-columns: 1fr;
      }
      header {
        align-items: flex-start;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand">
        <div>
          <p class="brand-title">DNS Tools</p>
          <p class="brand-subtitle">Build 9</p>
        </div>
      </div>
    </header>

    <section class="layout">
      <aside class="panel side">
        <h1>DNS lookup</h1>
        <p>Check common DNS records, TXT records, MX, DMARC, and basic mail health from one simple page.</p>

        <form id="lookup-form">
          <label for="domain">Domain</label>
          <input id="domain" name="domain" autocomplete="off" spellcheck="false" placeholder="example.com">

          <label for="type">Record type</label>
          <div class="row">
            <select id="type" name="type">${typeOptions}</select>
            <button type="submit">Lookup</button>
          </div>

          <div class="actions">
            <button type="button" class="secondary" id="audit">Standard Records</button>
            <button type="button" class="secondary" id="ports">Common ports</button>
            <button type="button" class="secondary" id="domain-info">Domain info</button>
            <button type="button" class="secondary" id="all">All common records</button>
            <button type="button" class="secondary" id="mail">Mail check</button>
            <button type="button" class="secondary" id="copy">Copy results</button>
          </div>
        </form>

        <div class="status" id="status">Ready.</div>
      </aside>

      <section class="panel result">
        <div class="result-head">
          <p class="result-title" id="result-title">Results</p>
        </div>
        <div class="record-list" id="results">
          <div class="empty">Enter a domain and run a lookup.</div>
        </div>
      </section>
    </section>
  </main>

  <script>
    const form = document.getElementById("lookup-form");
    const domainInput = document.getElementById("domain");
    const typeInput = document.getElementById("type");
    const auditButton = document.getElementById("audit");
    const portsButton = document.getElementById("ports");
    const domainInfoButton = document.getElementById("domain-info");
    const allButton = document.getElementById("all");
    const mailButton = document.getElementById("mail");
    const copyButton = document.getElementById("copy");
    const statusBox = document.getElementById("status");
    const resultTitle = document.getElementById("result-title");
    const results = document.getElementById("results");
    let lastText = "";
    let lookupSequence = 0;

    const params = new URLSearchParams(location.search);
    if (params.get("domain")) {
      domainInput.value = params.get("domain");
    }

    function cleanDomain(value) {
      return value.trim().replace(/^https?:\\/\\//i, "").split("/")[0].replace(/^\\.+|\\.+$/g, "");
    }

    function escapeText(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]));
    }

    function setStatus(message) {
      statusBox.textContent = message;
    }

    function recordHtml(type, record, statusText) {
      const ttl = record.TTL ? "TTL " + record.TTL : statusText || "";
      return '<article class="record"><div class="record-top"><span>' + escapeText(type) + '</span><span>' + escapeText(ttl) + '</span></div><pre class="record-data">' + escapeText(record.data || "") + '</pre></article>';
    }

    function renderSingle(type, data) {
      const answers = data.Answer || [];
      resultTitle.textContent = type + " records";
      if (!answers.length) {
        results.innerHTML = '<div class="empty">No ' + escapeText(type) + ' records found.<br>Status: ' + escapeText(data.StatusText || data.Status) + '</div>';
        lastText = "No " + type + " records found.";
        return;
      }

      results.innerHTML = answers.map((record) => recordHtml(type, record, data.StatusText)).join("");
      lastText = answers.map((record) => type + " " + record.data).join("\\n");
    }

    function renderAll(data) {
      resultTitle.textContent = "All common records";
      const lines = [
        "DNS COMMON RECORDS",
        "Record types: A, AAAA, CNAME, MX, TXT, NS, SOA, CAA",
        ""
      ];

      for (const [type, response] of Object.entries(data)) {
        const answers = response.Answer || [];
        if (!answers.length) continue;
        lines.push(type + " RECORDS");
        lines.push("-".repeat(type.length + 8));

        for (const record of answers) {
          const ttl = record.TTL ? ("TTL " + String(record.TTL)).padEnd(10, " ") : "".padEnd(10, " ");
          lines.push(ttl + record.data);
        }

        lines.push("");
      }

      lastText = lines.join("\\n");
      results.innerHTML = '<div class="console-wrap"><pre class="console-output">' + escapeText(lastText) + '</pre></div>';
    }

    function renderMail(data) {
      resultTitle.textContent = "Mail check";
      const warnings = data.warnings.length
        ? data.warnings.map((warning) => '<div class="pill warning"><strong>' + escapeText(warning) + '</strong></div>').join("")
        : '<div class="pill"><strong>No obvious mail DNS warnings.</strong><span>Still worth checking the exact records when troubleshooting.</span></div>';

      results.innerHTML =
        '<div class="summary">' +
        '<div class="pill"><strong>' + escapeText(data.mx) + '</strong><span>MX</span></div>' +
        '<div class="pill"><strong>' + escapeText(data.spf) + '</strong><span>SPF</span></div>' +
        '<div class="pill"><strong>' + escapeText(data.dmarc) + '</strong><span>DMARC</span></div>' +
        warnings +
        '<article class="record"><div class="record-top"><span>Records</span><span>Mail DNS</span></div><pre class="record-data">' + escapeText(JSON.stringify(data.records, null, 2)) + '</pre></article>' +
        '</div>';

      lastText = JSON.stringify(data, null, 2);
    }

    function formatAnswers(answers) {
      if (!answers.length) return "No records found";
      return answers.map((answer) => {
        const ttl = answer.ttl ? "TTL " + answer.ttl + "  " : "";
        return ttl + answer.value;
      }).join("\\n");
    }

    function renderAudit(data) {
      resultTitle.textContent = "Standard Records";
      const found = data.checks.filter((check) => check.answers.length);
      const byType = {};
      for (const check of found) {
        byType[check.type] = byType[check.type] || [];
        byType[check.type].push(check);
      }

      const lines = [
        "DNS STANDARD RECORDS",
        "Domain: " + data.domain,
        "Found:  " + data.found + " of " + data.checked + " checks",
        ""
      ];
      if (data.crtNote) lines.push(data.crtNote, "");
      const failures = data.checks.filter(check => !["NOERROR", "NXDOMAIN"].includes(check.status)).length;
      if (failures) lines.push(failures + " DNS checks could not be completed.", "");
      if (!found.length) lines.push("No resolved records found.");

      function section(title, types) {
        if (!types.some(type => (byType[type] || []).length)) return;
        lines.push(title);
        lines.push("-".repeat(title.length));

        for (const type of types) {
          const checks = byType[type] || [];
          for (const check of checks) {
            for (const answer of check.answers) {
              const left = (check.name + " " + check.type).padEnd(48, " ");
              const ttl = answer.ttl ? ("TTL " + String(answer.ttl)).padEnd(10, " ") : "".padEnd(10, " ");
              lines.push(left + ttl + answer.value + (check.source === "crt.sh" ? "  [crt.sh]" : ""));
            }
          }
        }

        lines.push("");
      }

      section("A / AAAA RECORDS", ["A", "AAAA"]);
      section("CNAME RECORDS", ["CNAME"]);
      section("MX RECORDS", ["MX"]);
      section("TXT / AUTH RECORDS", ["TXT"]);
      section("NS / SOA / CAA RECORDS", ["NS", "SOA", "CAA"]);

      lastText = lines.join("\\n");
      results.innerHTML = '<div class="console-wrap"><pre class="console-output">' + escapeText(lastText) + '</pre></div>';
    }

    function renderPorts(data) {
      resultTitle.textContent = "Common ports";
      const lines = [
        "DNS COMMON PORTS",
        "Target: " + data.domain,
        "Open:   " + data.open + " of " + data.checked,
        ""
      ];

      function portSection(title, status) {
        const matches = data.results.filter((result) => result.status === status);
        lines.push(title);
        lines.push("-".repeat(title.length));

        if (!matches.length) {
          lines.push("None");
          lines.push("");
          return;
        }

        for (const result of matches) {
          const port = String(result.port).padEnd(8, " ");
          const time = (result.ms ? String(result.ms) + "ms" : "").padEnd(10, " ");
          lines.push(port + time + result.label);
        }
        lines.push("");
      }

      portSection("OPEN PORTS", "OPEN");
      portSection("CLOSED / FILTERED PORTS", "CLOSED");
      portSection("SKIPPED PORTS", "SKIPPED");

      lines.push("NOTE");
      lines.push("----");
      lines.push("This is a TCP connect check from Cloudflare, not a full security scan.");
      lines.push("Port 25 is skipped because Cloudflare blocks outbound TCP 25.");

      lastText = lines.join("\\n");
      results.innerHTML = '<div class="console-wrap"><pre class="console-output">' + escapeText(lastText) + '</pre></div>';
    }

    function renderDomainInfo(data) {
      resultTitle.textContent = "Domain info";
      const lines = [
        "DNS DOMAIN INFO",
        "Domain:     " + data.domain,
        "Registrar:  " + data.registrar,
        "Registrant: " + data.registrant,
        "Created:    " + data.created,
        "Updated:    " + data.updated,
        "Expires:    " + data.expires,
        "DNSSEC:     " + data.dnssec,
        ""
      ];

      lines.push("STATUS");
      lines.push("------");
      if (data.status && data.status.length) {
        for (const status of data.status) lines.push(status);
      } else {
        lines.push("Unknown");
      }

      lines.push("");
      lines.push("NAMESERVERS");
      lines.push("-----------");
      if (data.nameservers && data.nameservers.length) {
        for (const server of data.nameservers) lines.push(server);
      } else {
        lines.push("Unknown");
      }

      lines.push("");
      lines.push("DS RECORDS");
      lines.push("----------");
      if (data.ds && data.ds.length) {
        for (const record of data.ds) lines.push(record);
      } else {
        lines.push("No DS records found");
      }

      if (data.rdapError) {
        lines.push("");
        lines.push("RDAP NOTE");
        lines.push("---------");
        lines.push(data.rdapError);
      }

      lastText = lines.join("\\n");
      results.innerHTML = '<div class="console-wrap"><pre class="console-output">' + escapeText(lastText) + '</pre></div>';
    }

    async function runLookup(mode = "single") {
      const domain = cleanDomain(domainInput.value);
      if (!domain) {
        setStatus("Enter a domain first.");
        return;
      }
      const sequence = ++lookupSequence;

      const url = new URL(location.href);
      url.searchParams.set("domain", domain);
      history.replaceState(null, "", url);

      setStatus("Looking up " + domain + "...");
      results.innerHTML = '<div class="empty">Checking DNS...</div>';

      const api = new URL("/api/lookup", location.origin);
      api.searchParams.set("name", domain);
      api.searchParams.set("mode", mode);
      api.searchParams.set("type", typeInput.value);

      const response = await fetch(api);
      let data = await response.json();
      if (sequence !== lookupSequence) return;
      if (!response.ok) {
        throw new Error(data.error || "Lookup failed.");
      }

      if (mode === "audit") {
        while (data.nextOffset !== null && data.nextOffset !== undefined) {
          setStatus("Checking Standard Records: " + data.checked + " of " + data.total + "...");
          api.searchParams.set("offset", data.nextOffset);
          const nextResponse = await fetch(api);
          const batch = await nextResponse.json();
          if (sequence !== lookupSequence) return;
          if (!nextResponse.ok) throw new Error(batch.error || "Lookup failed.");
          data = {
            ...batch,
            checked: data.checked + batch.checked,
            found: data.found + batch.found,
            checks: data.checks.concat(batch.checks),
          };
        }
        // Show standard results immediately while the certificate search runs.
        renderAudit(data);
        setStatus("Searching crt.sh for additional hostnames...");
        try {
          const discoveryApi = new URL("/api/lookup", location.origin);
          discoveryApi.searchParams.set("name", domain);
          discoveryApi.searchParams.set("mode", "crt");
          const discoveryResponse = await fetch(discoveryApi);
          const discovery = await discoveryResponse.json();
          if (sequence !== lookupSequence) return;
          if (!discoveryResponse.ok) throw new Error(discovery.error || "Search failed.");

          const existing = new Set(data.checks.map(check => check.name + "|" + check.type));
          const tasks = discovery.names.flatMap(name => ["A", "AAAA", "CNAME"].map(type => ({ name, type })))
            .filter(task => !existing.has(task.name + "|" + task.type));
          data.crtNote = "crt.sh: " + discovery.names.length + " certificate hostnames discovered." +
            (discovery.limited ? " Limited to the first 1,000 unique hostnames." : "");
          discoveryApi.searchParams.set("mode", "crt-records");
          for (let offset = 0; offset < tasks.length; offset += 40) {
            setStatus("Verifying crt.sh names in DNS: " + offset + " of " + tasks.length + " checks...");
            const checksResponse = await fetch(discoveryApi, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ tasks: tasks.slice(offset, offset + 40) }),
            });
            const batch = await checksResponse.json();
            if (sequence !== lookupSequence) return;
            if (!checksResponse.ok) throw new Error(batch.error || "DNS verification failed.");
            data.checks = data.checks.concat(batch.checks);
            data.checked += batch.checks.length;
            data.found += batch.checks.filter(check => check.answers.length).length;
            renderAudit(data);
          }
        } catch (error) {
          if (sequence !== lookupSequence) return;
          data.crtNote = "crt.sh discovery incomplete: " + (error.message || "Service unavailable.") +
            " Showing completed DNS checks.";
        }
      }

      if (mode === "audit") renderAudit(data);
      else if (mode === "ports") renderPorts(data);
      else if (mode === "domain") renderDomainInfo(data);
      else if (mode === "all") renderAll(data);
      else if (mode === "mail") renderMail(data);
      else renderSingle(typeInput.value, data);

      setStatus(data.crtNote?.startsWith("crt.sh discovery incomplete") ? "Done. crt.sh discovery incomplete." : "Done.");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await runLookup("single");
      } catch (error) {
        setStatus(error.message || "Lookup failed.");
        results.innerHTML = '<div class="empty">Lookup failed.</div>';
      }
    });

    auditButton.addEventListener("click", async () => {
      try {
        await runLookup("audit");
      } catch (error) {
        setStatus(error.message || "Lookup failed.");
      }
    });

    portsButton.addEventListener("click", async () => {
      try {
        await runLookup("ports");
      } catch (error) {
        setStatus(error.message || "Lookup failed.");
      }
    });

    domainInfoButton.addEventListener("click", async () => {
      try {
        await runLookup("domain");
      } catch (error) {
        setStatus(error.message || "Lookup failed.");
      }
    });

    allButton.addEventListener("click", async () => {
      try {
        await runLookup("all");
      } catch (error) {
        setStatus(error.message || "Lookup failed.");
      }
    });

    mailButton.addEventListener("click", async () => {
      try {
        await runLookup("mail");
      } catch (error) {
        setStatus(error.message || "Lookup failed.");
      }
    });

    copyButton.addEventListener("click", async () => {
      if (!lastText) {
        setStatus("Nothing to copy yet.");
        return;
      }
      try {
        await navigator.clipboard.writeText(lastText);
        setStatus("Copied results.");
      } catch {
        setStatus("Copy failed.");
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: noStoreHeaders("text/html"),
  });
}

export default {
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/lookup" || url.pathname === "/json") {
      return apiResponse(request);
    }

    return pageResponse();
  },
};
