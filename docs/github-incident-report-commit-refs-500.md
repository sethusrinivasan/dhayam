# GitHub Service Incident Report: Server-Side 500 Internal Server Error on Git Reference Updates (`commit_refs`)

**Ticket Category**: Git Infrastructure / Core Services / Reference Transaction Engine  
**Severity**: High (Blocking all code pushes & branch ref updates to repository)  
**Date & Time**: 2026-11-05 00:25:32 UTC (Local: 2026-11-04 16:25:32 PDT)  
**Repository**: `sethusrinivasan/dhayam`  
**Repository ID**: `1440183363` (`node_id: R_kgDOVdd0Qw`)  
**Account / Owner**: `sethusrinivasan` (`id: 3907049`)  
**Impacted Branch / Ref**: `refs/heads/main` (and all attempts to create new branch refs)  

---

## 1. Executive Summary

Attempts to update `refs/heads/main` or create any new branch references in `sethusrinivasan/dhayam` fail consistently with a server-side error:
- **Git Smart HTTP Protocol**: `remote: fatal error in commit_refs` → `! [remote rejected] main -> main (failure)`
- **GitHub REST API (`PATCH /repos/sethusrinivasan/dhayam/git/refs/heads/main`)**: `HTTP/2 500 Internal Server Error` with empty response body (`Content-Length: 0`).
- **GitHub REST API (`POST /repos/sethusrinivasan/dhayam/git/refs`)**: `HTTP/2 422 Unprocessable Entity` (`"Reference update failed"`).

Crucially, **Git object transfer succeeds**: commit object `d9bfaed855325d26dc820459b6d3132f661c7eb1` (along with all tree and blob dependencies) was unpacked and persisted in GitHub's object store. The failure is strictly isolated to GitHub's internal reference transaction backend (`commit_refs` / ref database locking).

---

## 2. GitHub Traceability & Request IDs

The issue reproduces across multiple GitHub edge regions. Here are exact trace headers from live occurrences:

| Timestamp (UTC) | GitHub Edge Region | HTTP Status | GitHub Request ID (`X-GitHub-Request-Id`) | Operation |
|---|---|---|---|---|
| `2026-11-05 02:19:43 GMT` | `sea` | `500 Internal Server Error` | `806A:1666:903155:D1F691:6AEBE7BF` | `POST /git-receive-pack (commit_refs)` |
| `2026-11-05 01:49:43 GMT` | `westus2` | `500 Internal Server Error` | `E092:A8DA9:142FF7:2DFB09:6AEBE0B6` | `POST /git-receive-pack (commit_refs)` |
| `2026-11-05 01:28:51 GMT` | `westus2` | `500 Internal Server Error` | `D8A6:10F28:137FA8:2C5D05:6AEBDBD2` | `POST /git-receive-pack (commit_refs)` |
| `2026-11-05 00:25:32 GMT` | `westus2` | `500 Internal Server Error` | `D05E:DE9E7:1A8C37:2D3D4E:6AEBCCFA` | `PATCH /git/refs/heads/main` |
| `2026-11-05 00:23:42 GMT` | `sea` | `500 Internal Server Error` | `C5C0:1640:16030E0:1F5A403:6AEBCC8C` | `PATCH /git/refs/heads/main` |
| `2026-11-05 00:17:08 GMT` | `westus2` | `500 Internal Server Error` | `E626:FCAD6:1A29F0:2C8448:6AEBCB02` | `PATCH /git/refs/heads/main` |
| `2026-11-05 00:23:29 GMT` | `sea` | `422 Unprocessable Entity` | `A488:316A9F:1C04364:27B82FF:6AEBCC7F` | `POST /git/refs` |
| `2026-11-05 00:17:15 GMT` | `westus2` | `422 Unprocessable Entity` | `CF3E:2FB765:1A5F4F:2CACA7:6AEBCB08` | `POST /git/refs` |

---

## 3. Evidence of Successful Object Ingestion

To confirm this is not a packfile corruption, transmission drop, or malformed Git object:
A `GET` request to GitHub's commit object endpoint for the target commit SHA returns `200 OK` with the full commit payload:

```sh
GET https://api.github.com/repos/sethusrinivasan/dhayam/git/commits/d9bfaed855325d26dc820459b6d3132f661c7eb1
```

**Response**:
```json
{
  "sha": "d9bfaed855325d26dc820459b6d3132f661c7eb1",
  "node_id": "C_kwDOVdd0Q9oAKGQ5YmZhZWQ4NTUzMjVkMjZkYzgyMDQ1OWI2ZDMxMzJmNjYxYzdlYjE",
  "author": {
    "name": "Sethu Srinivasan",
    "email": "sethusrinivasan@gmail.com",
    "date": "2026-11-05T00:15:42Z"
  },
  "committer": {
    "name": "Sethu Srinivasan",
    "email": "sethusrinivasan@gmail.com",
    "date": "2026-11-05T00:15:42Z"
  },
  "tree": {
    "sha": "e8924573969dbc8dad5ca899869258b9bd940cd7"
  },
  "message": "feat: expand festive themes, add roll secret entropy, and stabilize CI test suites",
  "parents": [
    {
      "sha": "1d78fb6598e78ad8fd999125dc4f9e6d692bf25b"
    }
  ]
}
```

This establishes that GitHub has already validated the parent graph, tree objects, and commit tree-ish. Only the final ref pointing step (`refs/heads/main` -> `d9bfaed...`) crashes.

---

## 4. Policy, Permission & Configuration Audit

We verified all permission boundaries to eliminate client-side configuration causes:
1. **Repository Access Level**:
   - `permissions: { "admin": true, "maintain": true, "push": true }`
   - `role_name: "admin"`
2. **Branch Protection**:
   - `GET /repos/sethusrinivasan/dhayam/branches/main/protection` → `HTTP 404 (Branch not protected)`
3. **Repository Rulesets**:
   - `GET /repos/sethusrinivasan/dhayam/rulesets` → `[]` (no rulesets active)
4. **Secret Scanning Push Protection**:
   - `security_and_analysis.secret_scanning_push_protection.status: "disabled"`
5. **OAuth Token Scopes**:
   - `X-OAuth-Scopes: gist, read:org, repo, workflow`

---

## 5. Step-by-Step Reproduction Commands

### Method A: Git Smart HTTP (`git-receive-pack`)
```sh
git push origin main
```
**Terminal Output**:
```text
Writing objects: 100% (30/30), 9.09 KiB | 9.09 MiB/s, done.
Total 30 (delta 26), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (26/26), completed with 26 local objects.
remote: fatal error in commit_refs
To https://github.com/sethusrinivasan/dhayam.git
 ! [remote rejected] main -> main (failure)
error: failed to push some refs to 'https://github.com/sethusrinivasan/dhayam.git'
```

### Method B: REST API Reference Update
```sh
curl -i -X PATCH https://api.github.com/repos/sethusrinivasan/dhayam/git/refs/heads/main \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d '{"sha":"d9bfaed855325d26dc820459b6d3132f661c7eb1","force":false}'
```
**HTTP Response**:
```http
HTTP/2 500 
date: Thu, 05 Nov 2026 00:25:32 GMT
content-type: application/json; charset=utf-8
content-length: 0
server: github.com
x-github-request-id: D05E:DE9E7:1A8C37:2D3D4E:6AEBCCFA
x-github-edge-region: westus2
```

---

## 6. Suspected Engineering Causes

Based on GitHub's Git architecture (DGit/Spokes and reference transaction managers):
1. **Stale Lockfile / Ref Lock**: A previous push event (e.g. at `2026-11-03T22:59:39Z`) or background CI dispatch may have left an unreleased lockfile on the remote storage node (e.g., `refs/heads/main.lock` or a locked packed-refs transaction).
2. **DGit / Spokes Replica Quorum Conflict**: Out-of-sync or unresponsive storage server replicas in cluster `westus2`/`sea` preventing the reference update transaction from committing across the quorum.
3. **Reference Storage DB Corruption**: An internal inconsistency in the repository's reference database preventing writes to any `refs/heads/*` ref namespace.

---

## 7. Requested Action from GitHub Support / Engineering

1. Inspect internal application logs for `X-GitHub-Request-Id: D05E:DE9E7:1A8C37:2D3D4E:6AEBCCFA` and `C5C0:1640:16030E0:1F5A403:6AEBCC8C`.
2. Clear any lingering stale ref locks (`*.lock`) or stalled transactions on the storage nodes hosting repository `1440183363`.
3. Run a `git fsck` and reference consistency verification across all active DGit replicas for `sethusrinivasan/dhayam`.
4. Point `refs/heads/main` to already-ingested commit `d9bfaed855325d26dc820459b6d3132f661c7eb1`.
