#!/bin/bash

get_funds_from_faucet() {
    echo "Sending request to the faucet"
    yagna payment fund
}

echo "Starting Yagna"
yagna service run --api-allow-origin="*" & # start Yagna in the background
sleep 4 # wait for Yagna to start
while true; do
    get_funds_from_faucet
    sleep 30
done
