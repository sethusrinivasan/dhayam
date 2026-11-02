#!/usr/bin/env bash
#
# Collect host-side evidence after a browser or desktop freeze.
# The output is local-only and intentionally excludes browser profiles,
# cookies, crash dumps, and game contents.
#
# Usage:
#   ./scripts/collect-postmortem.sh
#   SINCE='2026-11-02 08:55:00' UNTIL='2026-11-02 10:06:00' \
#     ./scripts/collect-postmortem.sh
#
set -u

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_dir="${DHAYAM_POSTMORTEM_DIR:-${TMPDIR:-/tmp}/dhayam-postmortem-${timestamp}}"
since="${SINCE:-15 minutes ago}"
until="${UNTIL:-now}"

mkdir -p "$output_dir"

run_capture() {
  local name="$1"
  shift
  {
    printf 'command:'
    printf ' %q' "$@"
    printf '\n\n'
    "$@"
  } >"$output_dir/$name.txt" 2>&1 || true
}

run_capture "system" bash -c '
  printf "captured_at_utc=%s\n" "$(date -u --iso-8601=seconds)"
  uname -a
  printf "\n[uptime]\n"; uptime
  printf "\n[memory]\n"; free -h
  printf "\n[load]\n"; cat /proc/loadavg
  printf "\n[disk]\n"; df -h / /home
  printf "\n[session]\n"
  printf "XDG_SESSION_TYPE=%s\nWAYLAND_DISPLAY=%s\nDISPLAY=%s\n" \
    "${XDG_SESSION_TYPE:-}" "${WAYLAND_DISPLAY:-}" "${DISPLAY:-}"
'

run_capture "gpu" bash -c '
  printf "[pci]\n"; lspci -nnk 2>/dev/null | grep -A4 -Ei "vga|3d|display" || true
  printf "\n[render_nodes]\n"; ls -l /dev/dri/renderD* 2>/dev/null || true
  printf "\n[kernel_cmdline]\n"; cat /proc/cmdline
'

run_capture "processes" ps -eo pid,ppid,stat,%cpu,%mem,rss,etime,cmd --sort=-%cpu

run_capture "browser_versions" bash -c '
  /opt/google/chrome/google-chrome --version 2>/dev/null || true
  google-chrome --version 2>/dev/null || true
  chromium --version 2>/dev/null || true
'

run_capture "journal_incident" bash -c '
  journalctl --since "$1" --until "$2" --no-pager -o short-iso 2>/dev/null |
    grep -Ei "chrome|chromium|gnome-shell|nouveau|dmar|oom|killed process|segfault|gpu|watchdog|freeze|hung|error|fail|reset" |
    head -500 ||
    true
' bash "$since" "$until"

run_capture "journal_kernel" bash -c '
  journalctl -k --since "$1" --until "$2" --no-pager -o short-iso 2>/dev/null || true
' bash "$since" "$until"

{
  printf 'captured_at_utc=%s\n' "$(date -u --iso-8601=seconds)"
  printf 'Crash reports are listed by metadata only; dumps are intentionally excluded.\n\n'
  for report in /var/crash/*.crash; do
    [ -f "$report" ] || continue
    printf '%s\n' "--- $report"
    strings "$report" 2>/dev/null |
      grep -E '^(ProblemType|Date|ExecutablePath|Package|PackageArchitecture|ProcCmdline|Signal|SignalName|Title|SourcePackage|Uname|Architecture)' ||
      true
  done
} >"$output_dir/crash-reports.txt"

{
  printf 'captured_at_utc=%s\n' "$(date -u --iso-8601=seconds)"
  find "$HOME/.config/google-chrome/Crash Reports" \
    -maxdepth 2 -type f -printf '%p %s bytes %TY-%Tm-%Td %TH:%TM\n' 2>/dev/null |
    sort
} >"$output_dir/chrome-crash-artifacts.txt"

if git -C "$(dirname "$0")/.." rev-parse --show-toplevel >/dev/null 2>&1; then
  git_root="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
  {
    printf 'captured_at_utc=%s\n\n' "$(date -u --iso-8601=seconds)"
    git -C "$git_root" --no-pager status --short
    printf '\n[head]\n'
    git -C "$git_root" --no-pager log -1 --oneline --decorate
  } >"$output_dir/repository.txt"
fi

(
  cd "$output_dir" &&
  sha256sum ./*.txt 2>/dev/null
) >"$output_dir/SHA256SUMS"

printf 'Postmortem evidence written to %s\n' "$output_dir"
printf 'Attach the text files and the Dhayam Flight Recorder JSON; do not attach crash dumps or browser profiles.\n'
