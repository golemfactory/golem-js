#!/bin/bash

get_funds_from_faucet() {
    echo "Sending request to the faucet"
    yagna payment fund
}

# echo "Starting Yagna in the background to get funds from the faucet"
echo "Starting Yagna"
# yagna service run >/dev/null 2>&1 &
yagna service run --api-allow-origin="*"
# sleep 1

# PID=$(pgrep -f "yagna service run")
# echo "Yagna is running with PID: $PID"

# sleep 4

# echo "I will now try to get funds from the faucet"
# FUNDING_STATUS="NO"

# while [[ $FUNDING_STATUS == "NO" ]]; do
#     if get_funds_from_faucet; then
#         echo "Funds received from the faucet"
#         FUNDING_STATUS="OK"
#     else
#         echo "Error receiving funds from the faucet. We're retrying..."
#     fi
# done

# stop_yagna=$(kill -9 $PID)

# echo "Stopped Yagna"
# sleep 4

# echo "Starting Yagna again to run it in the foreground"
# yagna service run
