# Report Cleanup Workflow

Use this workflow when existing catalog `Report` rows may be linked to the wrong `Company`.

The cleanup command is intentionally audit-first. It never mutates the database unless an operator passes explicit report ids and `--confirm`.

## Audit

```sh
npm run reports:audit --workspace @bei/shared
```

For machine-readable output:

```sh
npm run reports:audit --workspace @bei/shared -- --format json
```

The audit lists likely mismatches with:

- report id
- job id
- fiscal year, report type, and language
- current catalog company
- AI-extracted company
- match confidence
- suggested company when the extracted company matches another catalog company
- report `s3_key`

## Move Bad Rows To Unmatched

After reviewing the audit output, move confirmed bad rows to the admin unmatched bucket:

```sh
npm run reports:audit --workspace @bei/shared -- --move-to-unmatched <report-id>[,<report-id>] --confirm
```

Without `--confirm`, the command prints a dry-run and does not mutate the database.

The command refuses to move ids that are not currently flagged by the mismatch audit. This keeps the cleanup path narrow: it is for removing bad company links, not arbitrary report editing.

## After Moving

Review `/admin/unmatched` and choose one of:

- map the report to the correct company
- leave it unmatched for further investigation
- reprocess/delete the report if the uploaded source was wrong

Do not bulk-remap reports only from the audit suggestion. The suggestion is a hint, not an authoritative source-of-truth decision.
