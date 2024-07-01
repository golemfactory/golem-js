#!/bin/bash

get_funds_from_faucet() {
    echo "Sending request to the faucet"
    yagna payment fund --network ${PAYMENT_NETWORK}
}
echo "Starting Yagna"
yagna service run --api-allow-origin="*"
