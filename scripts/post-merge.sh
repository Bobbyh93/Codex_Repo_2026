#!/bin/bash
set -e
npm install
<<<<<<< HEAD
npm run db:push
=======
# Replit post-merge runs non-interactively. Drizzle can ask whether to
# truncate tables when adding constraints; answer "no" so production data is
# preserved and the setup does not hang until timeout.
printf 'n\n' | npm run db:push
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
