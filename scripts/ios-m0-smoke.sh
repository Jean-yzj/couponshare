#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"

need() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env: $name" >&2
    exit 1
  fi
}

json_get() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const p=process.argv[1].split(".");let v=JSON.parse(s);for(const k of p)v=v?.[k]; if(v==null) process.exit(1); console.log(v);})' "$1"
}

curl_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  shift 3 || true
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "$url" -H "Content-Type: application/json" "$@" --data "$body"
  else
    curl -sS -X "$method" "$url" "$@"
  fi
}

need EMAIL
need PASSWORD

echo "== POST /auth/token"
TOKEN_RESP="$(curl_json POST "$BASE_URL/auth/token" "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
echo "$TOKEN_RESP"
TOKEN="$(printf '%s' "$TOKEN_RESP" | json_get token)"

echo
echo "== GET /auth/me with Bearer"
curl_json GET "$BASE_URL/auth/me" "" -H "Authorization: Bearer $TOKEN"
echo

echo
echo "== GET /auth/me with wrong Bearer"
curl_json GET "$BASE_URL/auth/me" "" -H "Authorization: Bearer wrong.token.value"
echo

echo
echo "== POST/DELETE /me/push-tokens"
PUSH_TOKEN="${PUSH_TOKEN:-ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]}"
curl_json POST "$BASE_URL/me/push-tokens" "{\"token\":\"$PUSH_TOKEN\",\"platform\":\"ios\"}" -H "Authorization: Bearer $TOKEN"
echo
curl_json DELETE "$BASE_URL/me/push-tokens" "{\"token\":\"$PUSH_TOKEN\"}" -H "Authorization: Bearer $TOKEN"
echo

if [[ -n "${GOOGLE_ID_TOKEN:-}" ]]; then
  echo
  echo "== POST /auth/google/native"
  curl_json POST "$BASE_URL/auth/google/native" "{\"id_token\":\"$GOOGLE_ID_TOKEN\"}"
  echo
fi

if [[ -n "${APPLE_IDENTITY_TOKEN:-}" ]]; then
  echo
  echo "== POST /auth/apple"
  curl_json POST "$BASE_URL/auth/apple" "{\"identity_token\":\"$APPLE_IDENTITY_TOKEN\",\"full_name\":\"Apple 測試者\"}"
  echo
fi

if [[ -n "${BLOCK_USER_ID:-}" ]]; then
  echo
  echo "== POST/GET/DELETE /me/blocks"
  curl_json POST "$BASE_URL/me/blocks" "{\"user_id\":\"$BLOCK_USER_ID\"}" -H "Authorization: Bearer $TOKEN"
  echo
  curl_json GET "$BASE_URL/me/blocks" "" -H "Authorization: Bearer $TOKEN"
  echo
  curl_json DELETE "$BASE_URL/me/blocks/$BLOCK_USER_ID" "" -H "Authorization: Bearer $TOKEN"
  echo
fi

if [[ -n "${DELETE_ACCOUNT_EMAIL:-}" && -n "${DELETE_ACCOUNT_PASSWORD:-}" ]]; then
  echo
  echo "== DELETE /me using disposable account"
  DEL_RESP="$(curl_json POST "$BASE_URL/auth/token" "{\"email\":\"$DELETE_ACCOUNT_EMAIL\",\"password\":\"$DELETE_ACCOUNT_PASSWORD\"}")"
  echo "$DEL_RESP"
  DEL_TOKEN="$(printf '%s' "$DEL_RESP" | json_get token)"
  curl_json DELETE "$BASE_URL/me" "" -H "Authorization: Bearer $DEL_TOKEN"
  echo
  echo "== Deleted account login should fail"
  curl_json POST "$BASE_URL/auth/token" "{\"email\":\"$DELETE_ACCOUNT_EMAIL\",\"password\":\"$DELETE_ACCOUNT_PASSWORD\"}" || true
  echo
fi
