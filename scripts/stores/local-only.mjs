/**
 * An endpoint override that credentials follow.
 *
 * CWS_TOKEN_URL, CWS_API and AMO_API exist so the self-tests can point the clients
 * at a fake store. The same variables, inherited from a shell on the maintainer's
 * machine, would send the service-account JWT, the bearer token or the AMO JWT to
 * wherever they name. So an override is accepted only when it points at this
 * machine over loopback; anything else stops the run before a credential is read.
 */
export function endpoint(name, fallback, die) {
  const v = process.env[name];
  if (!v) return fallback;
  if (/^http:\/\/127\.0\.0\.1(:\d+)?(\/|$)/.test(v)) return v;
  die(`${name} may only point at http://127.0.0.1 (the self-test server), not ${v}`);
}
