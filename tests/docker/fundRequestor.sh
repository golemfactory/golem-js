#!/bin/bash

for i in {1..5}; do
    yagna payment fund --network goerli && yagna payment status && exit 0
done

echo "yagna payment fund failed" >&2
exit 1