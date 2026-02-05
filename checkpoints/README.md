# Project Checkpoints

This folder contains snapshots of the project at key stages of the Xray Integration.

## [Checkpoint 1: Standalone Implementation](./checkpoint_1_standalone)
**State**: Before Merge/Refactor.
- **Location**: `features/xray-fixtures.js`
- **Pattern**: Standalone Test Object (`test.extend`)
- **Config**: `jsconfig` pointed to `features/index.js`
- **Globals**: `fixture/index.js` was UNTOUCHED.

## [Checkpoint 2: Integrated Implementation](./checkpoint_2_integrated)
**State**: Current / Refactored.
- **Location**: `fixture/xray-fixtures.js`
- **Pattern**: Registry function (`registerXray(globals)`)
- **Config**: `jsconfig` points to `fixture/index.js`
- **Globals**: `fixture/index.js` IMPORTS and CHAINS `registerXray`.

---
To revert to a checkpoint, copy the files from the respective folder back to the root (matching their original paths).
