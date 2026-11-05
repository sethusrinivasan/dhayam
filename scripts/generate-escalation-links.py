import urllib.parse

title = "[CRITICAL] Server-side 500 error in commit_refs on sethusrinivasan/dhayam"

body = """### Describe the bug
All Git pushes to repository `sethusrinivasan/dhayam` (Repo ID: 1440183363) are failing with server-side error:
`remote: fatal error in commit_refs`
`! [remote rejected] main -> main (failure)`

### Server-side Trace & Request IDs
Git object upload succeeds 100%, but the reference transaction manager crashes with HTTP 500:
- Request ID: `806A:1666:903155:D1F691:6AEBE7BF` (2026-11-05 02:19:43 GMT, Region: sea)
- Request ID: `E092:A8DA9:142FF7:2DFB09:6AEBE0B6` (2026-11-05 01:49:43 GMT, Region: westus2)
- Request ID: `D8A6:10F28:137FA8:2C5D05:6AEBDBD2` (2026-11-05 01:28:51 GMT, Region: westus2)

Direct REST API verification:
`PATCH /repos/sethusrinivasan/dhayam/git/refs/heads/main` returns HTTP/2 500 Internal Server Error (empty body).
`git fsck --full` passes with 0 errors.

### Requested Action
Please inspect repository 1440183363 and clear any stale lockfile (`refs/heads/main.lock`) or reconcile replica shards."""

query = urllib.parse.urlencode({"category": "general", "title": title, "body": body})
discussion_url = "https://github.com/orgs/community/discussions/new?" + query

tweet_text = urllib.parse.quote(
    "@GitHubHelp Our repo sethusrinivasan/dhayam is blocked on pushes with server-side fatal error in commit_refs (HTTP 500). Request IDs: 806A:1666:903155:D1F691:6AEBE7BF, E092:A8DA9:142FF7:2DFB09:6AEBE0B6. Can SRE check the ref lock?"
)
tweet_url = "https://twitter.com/intent/tweet?text=" + tweet_text

support_url = "https://support.github.com/contact/bug-report"

print("SUPPORT_URL:\n", support_url)
print("\nDISCUSSION_URL:\n", discussion_url)
print("\nTWEET_URL:\n", tweet_url)
