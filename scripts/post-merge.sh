#!/bin/bash
set -e
npm install
# Replit post-merge runs non-interactively. Drizzle can ask whether to
# truncate tables when adding constraints; answer "no" so production data is
# preserved and the setup does not hang until timeout.
printf 'n\n' | npm run db:push
