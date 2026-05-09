# Kychon CLI

The `kychon` CLI is a thin wrapper over `@kychon/sdk`.

```sh
kychon api discover --portal https://example.kychon.com
kychon api capabilities --portal https://example.kychon.com
kychon api versions --portal https://example.kychon.com
```

Arbitrary envelopes are JSON-first:

```sh
kychon api call --portal https://example.kychon.com --json '{"operation":"search.query","phase":"query","input":{"q":"budget"}}'
```

Mutations support dry-run validation and explicit confirmation:

```sh
kychon event create --dry-run --json '{"title":"Board meeting"}'
kychon announcement publish --yes --json '{"title":"News","body":"Hello"}'
kychon member approve --yes --json '{"id":42}'
kychon forum topic create --dry-run --json '{"title":"Welcome","body":"Introduce yourself"}'
kychon poll vote --yes --json '{"pollId":1,"optionId":2}'
kychon exports membersCsv --dry-run
```
