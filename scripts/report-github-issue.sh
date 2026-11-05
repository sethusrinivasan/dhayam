#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# report-github-issue.sh
# Automated reporter for GitHub server-side 500 error on commit_refs
# -----------------------------------------------------------------------------

REPORT_FILE="docs/github-incident-report-commit-refs-500.md"

if [ ! -f "$REPORT_FILE" ]; then
  echo "Error: $REPORT_FILE not found."
  exit 1
fi

REPORT_BODY=$(cat "$REPORT_FILE")
REPORT_TITLE="[Bug]: Server-Side 500 Internal Server Error on Git Reference Updates (commit_refs) for repository 1440183363"

echo "================================================================="
echo " GitHub Incident Reporting Tool"
echo "================================================================="
echo ""
echo "Choose a reporting channel:"
echo " 1) Auto-post as public Discussion to GitHub Community (community/community)"
echo " 2) Open GitHub Support Bug Report portal in browser"
echo " 3) Print pre-formatted report for support.github.com copy-paste"
echo ""

read -rp "Enter choice [1-3]: " CHOICE

case "$CHOICE" in
  1)
    echo "Publishing to GitHub Community (category: Repositories)..."
    gh api graphql -F query='
      mutation($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: {
          repositoryId: $repoId,
          categoryId: $categoryId,
          title: $title,
          body: $body
        }) {
          discussion {
            url
            id
          }
        }
      }
    ' -f repoId="MDEwOlJlcG9zaXRvcnkzMDE1NzMzNDQ=" \
      -f categoryId="DIC_kwDOEfmk4M4CRofH" \
      -f title="$REPORT_TITLE" \
      -f body="$REPORT_BODY"
    echo ""
    echo "Successfully posted to GitHub Community!"
    ;;
  2)
    SUPPORT_URL="https://support.github.com/contact/bug-report"
    echo "Opening $SUPPORT_URL..."
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$SUPPORT_URL" || true
    fi
    echo "Please paste the contents of $REPORT_FILE into the support description."
    ;;
  3)
    echo "-----------------------------------------------------------------"
    cat "$REPORT_FILE"
    echo "-----------------------------------------------------------------"
    echo ""
    echo "Paste the text above into https://support.github.com/contact/bug-report"
    ;;
  *)
    echo "Invalid choice."
    exit 1
    ;;
esac
