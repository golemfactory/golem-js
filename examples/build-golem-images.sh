#!/usr/bin/env bash

echo "Building golem/alpine:latest"
docker build -t golem/alpine:latest -f hello-world/Dockerfile .
gvmkit-build --push golem/alpine:latest

echo "Building golem/imagemagick:latest"
docker build -t golem/imagemagick:latest -f web/imagemagick.Dockerfile .
gvmkit-build --push golem/imagemagick:latest

echo "Building golem/examples-ssh:latest"
docker build -t golem/examples-ssh:latest -f ssh/Dockerfile .
gvmkit-build --push golem/examples-ssh:latest

echo "Building golem/examples-hashcat:legacy"
docker build -t golem/examples-hashcat:legacy -f yacat/yacat.Dockerfile .
gvmkit-build --push golem/examples-hashcat:legacy