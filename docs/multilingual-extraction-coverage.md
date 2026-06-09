# Multilingual Extraction Coverage

The extraction pipeline accepts source filings in English, Estonian, Latvian, and Lithuanian. Regression coverage now pins the shared post-extraction behavior that the worker depends on before quality gates and catalog snapshots are created.

## Covered

- Metadata preservation for `companyName`, `reportPeriod`, `sourceLanguage`, and metadata evidence snippets across `en`, `et`, `lv`, and `lt`.
- Canonical metric mapping for common labels for:
  - revenue
  - EBITDA
  - net profit
  - free cash flow or operating cash flow
  - total assets
  - equity
  - liabilities
- Currency normalization for common whole EUR, thousand EUR, and million EUR forms, including Baltic abbreviations such as `tuhat EUR`, `tūkst. EUR`, `mln. EUR`, and `milj. EUR`.
- Quality-gate warnings when localized headline revenue metrics lack source evidence snippets.

## Remaining Limitations

- The tests use representative mocked extraction outputs, not full PDF parser/OCR fixtures. They prove language-aware normalization and validation after extraction, but they do not prove every real filing table layout parses correctly.
- Language support is label-pattern based for canonicalization. Unusual issuer-specific labels may still require new synonyms.
- Evidence quality still depends on the extractor returning source snippets and confidence; missing snippets are intentionally blocked by the quality gate.
- Issue #340 covers real-source diagnostics for the failed rerun candidates where parser/table extraction, language handling, or prompt behavior may still be the root cause.
