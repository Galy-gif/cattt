#!/bin/sh
set -e
cd "$(dirname "$0")/.."
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
swiftc ios/Maomao/Model/DiaryEntry.swift ios/Maomao/Model/DiaryStorage.swift \
  ios/DiaryTests/DiaryStorageTests.swift -o "$work_dir/DiaryStorageTests"
"$work_dir/DiaryStorageTests"
