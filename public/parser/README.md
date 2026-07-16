# demoparser2 WebAssembly artifacts

This directory receives the browser bindings generated from
[`LaihoE/demoparser`](https://github.com/LaihoE/demoparser) at commit
`ba39cc44cd5abfd7f34df2b3c0a7dd3630048311` (`v0.41.41`, MIT).

The generated JavaScript, WebAssembly, and `version.json` checksum manifest are
versioned with the application. Rebuild and verify them with:

```sh
npm run parser:build
npm run parser:verify
```

The build script initializes the pinned `vendor/demoparser` submodule and
verifies its exact commit. Linux CI runs `wasm-pack --target web`; locked-down
Windows hosts may use the exact Cargo + `wasm-bindgen` steps recorded in
`version.json`, with CI rejecting byte-level drift. At runtime these files are
loaded only inside `demo.worker.ts`; selected `.dem` files never leave the
browser.
