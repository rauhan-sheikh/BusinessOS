/**
 * Request metadata recorded alongside audit entries.
 *
 * The same two header reads were repeated at twelve call sites.
 */
export interface ClientInfo {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Note on ipAddress: x-forwarded-for is supplied by the caller in general, and
 * only trustworthy to the extent the hosting platform overwrites it. It is
 * recorded for forensics, and must never be used for authorization.
 */
export function getClientInfo(headers: Headers): ClientInfo {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return {
    ipAddress: forwarded || headers.get("x-real-ip") || null,
    userAgent: headers.get("user-agent"),
  };
}
