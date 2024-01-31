#!/bin/bash

# Get a list of recursively pinned items
pins=$(ipfs pin ls --type recursive --quiet)

# Unpin each item
for pin in $pins; do
  ipfs pin rm $pin
done
