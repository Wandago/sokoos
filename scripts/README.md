# Verification scripts

The parts of SokoOS that decide something about money are pure functions, so
they can be checked without a browser. Run them with:

```sh
npm run check
```

| Script | What it proves |
| --- | --- |
| `dedupe-check.ts` | A statement replayed against the books returns the right split of already-imported, duplicated-in-file, needs-review and new rows — and importing the same file twice adds nothing the second time. |
| `speech-check.ts` | Ten sentences a seller would actually say parse to the right amount, direction and counterparty, including spoken numbers ("three thousand five hundred") and shorthand ("2k"). |
| `desc-check.ts` | Parsed statement rows come out with clean narration, the code and columns stripped. |
| `cfo-check.ts` | The CFO brief's figures reconcile against the seeded ledger, and each finding carries its workings. |

They print `ok` / `FAIL` per assertion; `speech-check.ts` exits non-zero on
failure so it can gate a build.
