#!/bin/zsh
# Double-click in Finder to open the built app. No cloud setup is needed.
pros_dir="${0:A:h}"
pros_node="$(command -v node 2>/dev/null)"
if [[ -z "$pros_node" ]]; then
  for pros_candidate in "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" "/opt/homebrew/bin/node" "/usr/local/bin/node"; do
    if [[ -x "$pros_candidate" ]]; then
      pros_node="$pros_candidate"
      break
    fi
  done
fi
if [[ -z "$pros_node" ]]; then
  print "PROS needs Node.js to start its local app server."
  print "Install a current Node.js release from https://nodejs.org, then open this file again."
  read "pros_answer?Press Return to close this window. "
  exit 1
fi
cd "$pros_dir" || exit 1
"$pros_node" "$pros_dir/scripts/serve.mjs"
pros_status=$?
if [[ $pros_status -ne 0 ]]; then
  print ""
  read "pros_answer?Press Return to close this window. "
fi
exit $pros_status
