import dns from "node:dns/promises";
import net from "node:net";
import { HttpError } from "./http-errors";

const blockedHostnames = new Set([
  "localhost",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
]);

const isPrivateIpv4 = (value: string) => {
  const parts = value.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [first, second] = parts;

  if (first === 10 || first === 127) {
    return true;
  }

  if (first === 169 && second === 254) {
    return true;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  if (first === 192 && second === 168) {
    return true;
  }

  if (first === 100 && second >= 64 && second <= 127) {
    return true;
  }

  if (first === 198 && (second === 18 || second === 19)) {
    return true;
  }

  if (first === 0 || first >= 224) {
    return true;
  }

  return false;
};

const isPrivateIpv6 = (value: string) => {
  const normalized = value.toLowerCase();

  if (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    const embeddedIpv4 = normalized.slice("::ffff:".length);
    return isPrivateIpv4(embeddedIpv4);
  }

  return false;
};

const isBlockedAddress = (address: string) => {
  const ipVersion = net.isIP(address);

  if (ipVersion === 4) {
    return isPrivateIpv4(address);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6(address);
  }

  return false;
};

const normalizeHostname = (hostname: string) =>
  hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");

export const assertSafeMonitoringUrl = async (value: string) => {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError(400, "Invalid monitor target URL");
  }

  const hostname = normalizeHostname(parsed.hostname);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new HttpError(400, "Only http and https URLs are allowed");
  }

  if (
    blockedHostnames.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new HttpError(400, "Target host is not allowed");
  }

  if (isBlockedAddress(hostname)) {
    throw new HttpError(400, "Target IP address is not allowed");
  }

  try {
    const resolved = await dns.lookup(hostname, { all: true, verbatim: true });

    if (resolved.length === 0) {
      throw new HttpError(400, "Target host could not be resolved");
    }

    for (const entry of resolved) {
      if (isBlockedAddress(entry.address)) {
        throw new HttpError(400, "Target host resolves to a private or local address");
      }
    }
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(400, "Target host could not be resolved safely");
  }
};
