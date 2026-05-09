# Kychon API Release Checklist

- API version: `2026-05-08`
- SDK version: `0.1.0`
- CLI version: `0.1.0`
- Discovery document present: `/.well-known/kychon.json`
- Capability manifest present: `/kychon-capabilities.json`
- Docs present: API, SDK, CLI, examples, UI parity
- Conformance runner: `scripts/kychon-conformance.ts`
- Demo portal compatibility: Eagles, Silver Pines, Barrio Unido
- Backward compatibility: no existing UI, PostgREST, or function route removal required
- Raw access note: domain workflows prefer Capability API/SDK; SQL/PostgREST remains low-level escape hatch
