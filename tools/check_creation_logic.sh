#!/bin/sh
set -e
cd "$(dirname "$0")/.."
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
swiftc ios/Maomao/Model/CreationStorage.swift ios/CreationTests/CreationStorageTests.swift -o "$work_dir/CreationStorageTests"
"$work_dir/CreationStorageTests"
