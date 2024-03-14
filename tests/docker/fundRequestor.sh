#!/bin/bash

for i in {1..5}; do
    yagna payment fund --network ${PAYMENT_NETWORK} && yagna payment status --network ${PAYMENT_NETWORK} && exit 0
done

echo "yagna payment fund failed" >&2
exit 1