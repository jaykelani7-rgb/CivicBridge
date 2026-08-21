#!/usr/bin/env bash
# Idempotently configure the four deployed push subscriptions with dedicated DLQs.
# This script creates Pub/Sub resources and IAM bindings; review before running.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-civicbridge-1}"
MAX_DELIVERY_ATTEMPTS="${MAX_DELIVERY_ATTEMPTS:-5}"

if (( MAX_DELIVERY_ATTEMPTS < 5 || MAX_DELIVERY_ATTEMPTS > 100 )); then
  echo "MAX_DELIVERY_ATTEMPTS must be between 5 and 100" >&2
  exit 2
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SERVICE_AGENT="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"
SOURCE_SUBSCRIPTIONS=(
  ai-normalization-request-created
  ai-normalization-request-confirmed
  data-intelligence-normalized
  policy-impact-hotspot-updated
)

for source_subscription in "${SOURCE_SUBSCRIPTIONS[@]}"; do
  dead_letter_topic="${source_subscription}-dead-letter"
  inspection_subscription="${dead_letter_topic}-inspection"

  if ! gcloud pubsub topics describe "$dead_letter_topic" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud pubsub topics create "$dead_letter_topic" --project "$PROJECT_ID"
  fi
  if ! gcloud pubsub subscriptions describe "$inspection_subscription" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud pubsub subscriptions create "$inspection_subscription" \
      --project "$PROJECT_ID" \
      --topic "$dead_letter_topic"
  fi

  gcloud pubsub topics add-iam-policy-binding "$dead_letter_topic" \
    --project "$PROJECT_ID" \
    --member "serviceAccount:${SERVICE_AGENT}" \
    --role roles/pubsub.publisher >/dev/null
  gcloud pubsub subscriptions add-iam-policy-binding "$source_subscription" \
    --project "$PROJECT_ID" \
    --member "serviceAccount:${SERVICE_AGENT}" \
    --role roles/pubsub.subscriber >/dev/null

  # Updating only the dead-letter fields preserves push/OIDC, acknowledgement,
  # and retry settings already attached to the source subscription.
  gcloud pubsub subscriptions update "$source_subscription" \
    --project "$PROJECT_ID" \
    --dead-letter-topic "$dead_letter_topic" \
    --max-delivery-attempts "$MAX_DELIVERY_ATTEMPTS"
done

echo "Configured dedicated DLQs for ${#SOURCE_SUBSCRIPTIONS[@]} source subscriptions."
