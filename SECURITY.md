# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

Use this section to tell people how to report a vulnerability.

Tell them where to go, how often they can expect to get an update on a
reported vulnerability, what to expect if the vulnerability is accepted or
declined, etc.

## Outbound request policy

The preview and discovery endpoints fetch URLs supplied by the caller, so both routes reject
private, loopback, link-local, multicast and otherwise non-global addresses before a request
is made, and again for every redirect hop (`src/lib/urlGuard.ts`, `src/lib/safeFetch.ts`).

The check runs on the literal host, because the Workers runtime used by the default
deployment has no DNS API. A public hostname that resolves to a private address is therefore
not caught in the app. Deployments that run the Node adapter must enforce the same rule at
the network layer, for example with an egress allowlist or a firewall that blocks RFC1918,
loopback and link-local destinations. If that egress policy is in place, the in-app check is
a second line of defence rather than the only one.
