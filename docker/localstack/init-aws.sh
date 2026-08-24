#!/bin/sh
set -eu

create_queue() {
  queue_name="$1"
  dlq_name="$2"
  awslocal sqs create-queue --queue-name "$dlq_name"
  dlq_arn=$(awslocal sqs get-queue-attributes \
    --queue-url "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/$dlq_name" \
    --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)
  redrive_policy="{\"deadLetterTargetArn\":\"$dlq_arn\",\"maxReceiveCount\":\"5\"}"
  redrive_attribute="RedrivePolicy='$redrive_policy'"
  queue_url=$(awslocal sqs create-queue --queue-name "$queue_name" --query QueueUrl --output text)
  awslocal sqs set-queue-attributes --queue-url "$queue_url" \
    --attributes ReceiveMessageWaitTimeSeconds=10,VisibilityTimeout=30
  awslocal sqs set-queue-attributes --queue-url "$queue_url" \
    --attributes "$redrive_attribute"
}

create_queue audit-events audit-events-dlq
create_queue notifications notifications-dlq
