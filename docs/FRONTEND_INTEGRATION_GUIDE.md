# Frontend Integration Guide

## Runtime config
Set `VITE_API_BASE_URL` to backend `/api` base path.

## Main platform pages
- `/platform/assets`
- `/platform/repositories`
- `/platform/policies`
- `/platform/jobs`
- `/platform/backup`
- `/platform/restore`
- `/platform/progress`
- `/platform/logs`
- `/platform/operations`
- `/platform/report-templates`
- `/platform/dead-letters`
- `/platform/enterprise`

## Auth
Reuse existing login and token storage.
The platform API automatically forwards `X-Tenant-Id` from local storage.
