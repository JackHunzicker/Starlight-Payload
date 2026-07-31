#!/bin/bash
# Render ${VAR} config templates from an env file (default: docker/.env).
# The rendered outputs are gitignored — templates are the tracked truth.
# Usage: deploy/render-configs.sh [path/to/envfile]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT/docker/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "env file not found: $ENV_FILE" >&2
    exit 1
fi

# template (relative to repo root) -> output = same path minus .template
TEMPLATES=(
    "apps/sharkey/.config/default.yml.template"
)

render() {
    local template="$1"
    local out="${template%.template}"
    local content
    content="$(<"$ROOT/$template")"

    # Substitute ${KEY} for every KEY=value line in the env file. Values may
    # contain '=' (base64) — split on the first '=' only. Strip CR for
    # Windows-edited env files.
    while IFS='=' read -r key value; do
        [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
        value="${value%$'\r'}"
        # Strip surrounding double quotes, matching compose's env-file parsing.
        [[ "$value" =~ ^\"(.*)\"$ ]] && value="${BASH_REMATCH[1]}"
        content="${content//\$\{$key\}/$value}"
    done < <(grep -E '^[A-Z_][A-Z0-9_]*=' "$ENV_FILE")

    if grep -qE '\$\{[A-Z_][A-Z0-9_]*\}' <<<"$content"; then
        echo "UNRESOLVED tokens in $template:" >&2
        grep -oE '\$\{[A-Z_][A-Z0-9_]*\}' <<<"$content" | sort -u >&2
        exit 1
    fi

    printf '%s\n' "$content" > "$ROOT/$out"
    echo "rendered $out"
}

for template in "${TEMPLATES[@]}"; do
    render "$template"
done
