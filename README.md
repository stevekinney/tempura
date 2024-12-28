# Tempura

A though exercise to try to implement [Temporal](https://temporal.io)'s concepts from scratch.

**Nota bene**: This is a weekend experiment and is in _no way, shape, or form_ something you should actually use and it doesn't come in clause to Temporal's feature set.

## Install the Dependencies

```bash
bun install
```

## Run the Example

```bash
bun run src/index.ts
```

1. Run it the first time and you should see that all of the activities execute for the first time.
2. Run it a second time and you should see that all of the activities use their cached values. The functions do not execute a second time.
