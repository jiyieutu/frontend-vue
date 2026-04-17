#!/usr/bin/env bash
set -e
command -v node >/dev/null 2>&1 || { echo 'node not found'; exit 1; }
command -v npm >/dev/null 2>&1 || { echo 'npm not found'; exit 1; }
echo 'frontend environment check finished'
