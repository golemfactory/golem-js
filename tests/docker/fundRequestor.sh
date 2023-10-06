#!/bin/bash

for i in {1..3}; do
    yagna payment fund && exit 0
done

echo "yagna payment fund failed" >&2
exit 1