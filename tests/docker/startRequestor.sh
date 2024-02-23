#!/bin/bash

get_funds_from_faucet() {
    echo "Sending request to the faucet"
    yagna payment fund --network holesky
}
echo "Starting Yagna"
yagna service run --api-allow-origin="*"
