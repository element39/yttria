<div align="center">
  <img src="../assets/header.png" width="100%">
</div>

---
## roadmap

> [!NOTE]
> this roadmap is subject to change and might be innacurate/outdated at any time,
> please refer to the [status report](#status-report) for the most up-to-date information

<!-- https://ascii.bar -->

### language core
current version: `v0.0.3.alpha-1`
```
  item              xx%      progress  bar      time until complete (from last task)

  lexer             100%     █████████████      practically complete
  parser            100%     █████████████      practically complete
  typechecker       90%      ███████████▓░      complete soon
  codegen           80%      ██████████▓░░      actively being developed
  self-hosting       0%      ░░░░░░░░░░░░░      no eta
```

### std
```
  item              xx%      progress  bar      time until complete (from last task)

  std/io            0%       ░░░░░░░░░░░░░      no eta
  std/fs            0%       ░░░░░░░░░░░░░      no eta
  std/net           0%       ░░░░░░░░░░░░░      no eta
  std/math          0%       ░░░░░░░░░░░░░      no eta
```

### tools
```
  item              xx%      progress  bar      time until complete (from last task)

  cli               0%       ░░░░░░░░░░░░░      no eta
  language server   0%       ░░░░░░░░░░░░░      no eta
  extensions        0%       ░░░░░░░░░░░░░      no eta
```

## status report
> last updated: 23/08/2026 (dd/mm/yyyy)

yttria is still in early development; lexer and parser are actually finished now, type system is in its final stages of development & codegen is now working e2e. the module system now works & standard library is being developed and can now expose yttria wrappers around external C functions. the remaining parts of the standard library are still in the planning phase, and no developer tooling has been started yet. expect a lot of breaking changes in the future.
