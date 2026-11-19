#!/bin/sh
set -eu

for secret_file in /run/secrets/aegis_session_secret /run/secrets/aegis_ip_pepper; do
  if [ ! -r "$secret_file" ]; then
    echo "Required secret is missing: $secret_file" >&2
    exit 1
  fi
done

export AEGIS_SESSION_SECRET="$(tr -d '\n\r' < /run/secrets/aegis_session_secret)"
export AEGIS_IP_PEPPER="$(tr -d '\n\r' < /run/secrets/aegis_ip_pepper)"

if [ -r /run/secrets/postgres_password ]; then
  export AEGIS_DB_PASSWORD="$(tr -d '\n\r' < /run/secrets/postgres_password)"
fi

if [ -z "${AEGIS_ALLOWED_ORIGINS:-}" ]; then
  echo "AEGIS_ALLOWED_ORIGINS must be set." >&2
  exit 1
fi

exec /nodejs/bin/node /app/dist/server.js
