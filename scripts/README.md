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
| `stock-check.ts` | Lot costing allocates the whole landed cost and no more; splitting by sales value gives every grade the same margin; serialised stock is counted from units rather than typed; and each stock mode produces the right cost basis. |
| `swahili-check.ts` | 73 assertions across English, Kiswahili and Sheng: Swahili scale-first ordering (`elfu tatu na mia tano` = 3,500), compounds that only bind while the parts get smaller (`mia nne na hamsini` = 450, not 45,000), Sheng money words, durations on either side of the unit, and whole spoken sentences reaching the right amount, direction, counterparty and category. Also that a stated duration files a new catalogue entry as work rather than stock. |
| `services-check.ts` | An owner's hours are never charged as a cost while an employee's are, charged on the time the chair is occupied with buffers included; being quicker is measured against jobs actually done rather than a hypothetical week; capacity never claims free hours it does not have and reports an overbooked day rather than hiding it; the diary only lands on days people work; no offered slot collides with an existing job or runs past closing time; and a closed day has no capacity at all. |
| `delivery-check.ts` | A KES 500 dress delivered to Westlands for KES 200 produces the right numbers under all four settlement arrangements — the case that decides whether a seller's revenue is real. Also proves the ledger never charges the seller for a trip the customer paid for. |
| `cfo-check.ts` | The CFO brief's figures reconcile against the seeded ledger, and each finding carries its workings. |

They print `ok` / `FAIL` per assertion; `speech-check.ts` exits non-zero on
failure so it can gate a build.
