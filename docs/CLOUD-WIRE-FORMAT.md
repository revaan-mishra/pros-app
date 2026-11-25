# Cloud wire format3

This format is confined to the Firestore adapter. Local records, commands, progression rules, historical arrays and backup JSON do not change. Decode and validate before applying remote records; never use wire fields directly as game evidence.

## Why it exists

Firestore Rules limit expression evaluation. An otherwise valid legacy activity with eight skill allocations and six affinities each exceeded that budget. Merely changing nested maps to strings did not resolve it. Wire3 uses a bounded constructive encoding so range, uniqueness and near-total checks fit without discarding historical allocations or moving to a paid backend.

An affinity is represented as:

```text
attributeOrderRank:partCount:exactDecimalTotal:compositionRank
```

- The order rank selects one of 720 permutations of the fixed six attributes. The first 1–6 entries preserve the original unique order, including entries with zero weight.
- Canonical percentages are expanded to exact base-ten strings. Their common decimal precision defines integer units; each component is bounded by 100 times that scale.
- The composition rank selects a lexicographically ordered vector with that exact total and component bounds. Inclusion–exclusion/binomial counts support ranking and bounded binary-search decoding. Any accepted nonnegative rank is reduced modulo the feasible count, producing bounded nonnegative components rather than trusting a supplied checksum.
- Precision is capped at 330 decimal digits; ranks at 1,700 digits; part count at1–6. Bounds are checked before BigInt expansion. A single component’s total is also bounded lexically at100, including long decimals that would round to100 as a floating-point value.

An activity stores an allocation-percentage header plus bounded rows containing skill ID, region and the encoded affinities. The Rules still validate known regions, IDs, field bounds, allocation total, wrapper identity/revision and the atomic receipt/sequence protocol.

## Floating-point boundary policy

Canonical pre-upload and post-download validation retains its original absolute sum tolerance, strictly below 0.001. An exact decimal total can differ slightly from a JavaScript left-to-right floating-point sum. The wire-only total check therefore allows 0.001 plus a conservative 1e-12 roundoff allowance. This does not normalize records, change historical values, grant XP or widen canonical validation. It is explicitly a representation boundary; downloaded data still must pass the full canonical schema.

Do not claim that scalar Rules checks are bit-for-bit equivalent to every floating-point array calculation. Long objective/schedule/session arrays also retain bounded server checks plus full canonical client validation. This private personal-game protocol is not a competitive anti-cheat ledger.

## Compatibility and verification

Unversioned canonical-array cloud records and prior wire 2 ordered-string records remain readable. New writes use wire 3. Unknown future versions fail safely and preserve local work. Command fingerprints remain based on canonical commands, so the transport encoding cannot change their replay identity.

Automated coverage includes ordinary round trips, all 720 attribute orders, zeros/fractions/subnormal numbers,1,500 legal vectors,300 adversarial rank cases, malformed/oversized values, and specific previous floating-point boundary failures. A separate 73,900 accepted boundary-vector corpus encoded without failure. Ten thousand ordinary two-attribute decodes took 51 ms on the development host; this is not a device-performance measurement.

The final integration run passed 39 Rules cases and 8 real SDK emulator scenarios, including the full eight-allocation/six-affinity record, 101-record project commands and 400-record atomic writes. Physical-device, production restoration and broader security review remain separate gates. Source: `src/cloud/affinity-composition.ts`, `wire-codec.ts`, their tests, `firestore.rules` and the emulator suites.
