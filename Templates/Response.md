```
Done       <Added | Changed | Fixed | Removed | Found> [[thing]]
Open       [[thing]] is <not started | not done | blocked>
Needs you  <Decide [[ADR-nnnn]] | Approve <action> | Do <step>>
Check      <Run `command` | Open <link>> → <what you should see>
```

Each line is optional: include it only when there is something to say, and keep the order above, in at most 8 lines ([[ADR-0004]]). Start each line with one of its listed words; only the slot after it is free. Done and Open may repeat, one item per line. [[gherkin|Gherkin]] stays in [[spec|specs]].
