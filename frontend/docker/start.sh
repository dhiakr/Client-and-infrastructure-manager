#!/bin/sh
set -eu

echo "Frontend is available at http://localhost:3000"
echo "Do not use http://0.0.0.0:3000 in the browser."

exec npm run start -- --hostname 0.0.0.0
