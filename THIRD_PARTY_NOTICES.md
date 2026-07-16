# Third-party notices

This file records third-party material used by or evaluated for **OpenReplay —
CS2 2D Demo Viewer**. The project-level MIT license does not replace the license
or attribution requirements of third-party material.

## Provenance manifest

Immutable upstream revisions and SHA-256 hashes are recorded in the same change
that incorporates each parser artifact or asset.

| Component              | Use                                                                                                                                          | Upstream and license                                                                                                           | Pinned commit                                           | Local material and SHA-256                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demoparser2`          | Rust/WASM CS2 demo parser and browser bindings; its public `src/parser/test_demo.dem` is used in browser integration tests                   | [LaihoE/demoparser](https://github.com/LaihoE/demoparser), MIT; upstream license contains placeholder copyright fields         | `ba39cc44cd5abfd7f34df2b3c0a7dd3630048311` (`v0.41.41`) | Git submodule `vendor/demoparser`; `public/parser/demoparser2.js` SHA-256 `87A136DCCB1691E67F466BF45F0BAAEF6C64283A07572B77F9E4515398646471`; `public/parser/demoparser2_bg.wasm` SHA-256 `786D53DA0B46CBF4CBEA2F5EED721B2A50E2419181C25C336002C447A35BBCFB`; `public/parser/version.json` SHA-256 `0B107603AEFDEE4AB80B74B20806BD148009AD6AAB2CEDE2C30BE1C3A53832F5` |
| `demoparser-wasm-demo` | Architecture/build reference only; no copied file is currently recorded                                                                      | [LaihoE/demoparser-wasm-demo](https://github.com/LaihoE/demoparser-wasm-demo), verify upstream license before copying material | Not vendored                                            | None recorded                                                                                                                                                                                                                                                                                                                                                         |
| `cs2-2d-demoviewer`    | Source/reference for the Mirage radar and overview transform (`pos_x -3230`, `pos_y 1713`, scale `5.0`, zoom `1.1`, main level `-500..3000`) | [yerevin/cs2-2d-demoviewer](https://github.com/yerevin/cs2-2d-demoviewer), MIT, copyright 2026 CS2 2D Demo Viewer Contributors | `28edae96260d96c21be1f55b0f841285981a4eca`              | Upstream `assets/maps/de_mirage/de_mirage_radar.png` (WebP bytes despite its extension) copied as `public/maps/de_mirage/radar.webp` and the bundled `src/maps/assets/de_mirage.webp`, SHA-256 `7A4A6485FB5473CD8FD7FE0799E40113D104502DFFCB6EB126F68DC2BFDB29AE`; transform represented in `src/maps/mirage.ts`                                                      |

## Dependency locks and licenses

- Browser production dependencies are `react` 19.2.7, `react-dom` 19.2.7,
  and `scheduler` 0.27.0, all MIT licensed. Registry integrity values are
  recorded in `package-lock.json` (SHA-256
  `C7DF3E50DE2717E53210203DEFE53FE20EB68B275CD2597E327F77A0CA1AA04F`).
- The parser's complete Rust dependency graph, versions, registry checksums,
  and sources are recorded in `vendor/demoparser/src/wasm/Cargo.lock`
  (SHA-256
  `9FD2750836796B5F36E09E84E862BBBCAAE65D871A586EC6865CD89B08D4DA65`).
  Runtime crates use MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, Unlicense,
  and Unicode-3.0-compatible combinations as declared in their package
  metadata. The isolated browser build removes the declared but unused
  GPL-3.0-only `wasm-bindgen-file-reader` crate before compilation.
- Development-only npm tools are not shipped in the Pages bundle. Their exact
  versions, integrity values, and license metadata remain reproducibly pinned
  by `package-lock.json`.

### Rust WASM target inventory

The following registry packages are in Cargo's normal dependency graph for the
`wasm32-unknown-unknown` target at the pinned revision. Licenses are the SPDX
expressions declared by each package; registry checksums are in the Cargo lock
identified above.

| Crate                        | Version   | Declared license                    |
| ---------------------------- | --------- | ----------------------------------- |
| `ahash`                      | `0.8.11`  | MIT OR Apache-2.0                   |
| `aho-corasick`               | `1.1.3`   | Unlicense OR MIT                    |
| `anyhow`                     | `1.0.96`  | MIT OR Apache-2.0                   |
| `bit_reverse`                | `0.1.8`   | MIT/Apache-2.0                      |
| `bitter`                     | `0.7.1`   | MIT                                 |
| `bumpalo`                    | `3.17.0`  | MIT OR Apache-2.0                   |
| `byteorder`                  | `1.5.0`   | Unlicense OR MIT                    |
| `bytes`                      | `1.10.0`  | MIT                                 |
| `cfg-if`                     | `1.0.0`   | MIT/Apache-2.0                      |
| `convert_case`               | `0.4.0`   | MIT                                 |
| `crossbeam-deque`            | `0.8.6`   | MIT OR Apache-2.0                   |
| `crossbeam-epoch`            | `0.9.18`  | MIT OR Apache-2.0                   |
| `crossbeam-utils`            | `0.8.21`  | MIT OR Apache-2.0                   |
| `derive_more`                | `0.99.19` | MIT                                 |
| `either`                     | `1.14.0`  | MIT OR Apache-2.0                   |
| `getrandom`                  | `0.2.15`  | MIT OR Apache-2.0                   |
| `heck`                       | `0.5.0`   | MIT OR Apache-2.0                   |
| `itertools`                  | `0.10.5`  | MIT/Apache-2.0                      |
| `itertools`                  | `0.13.0`  | MIT OR Apache-2.0                   |
| `itertools`                  | `0.14.0`  | MIT OR Apache-2.0                   |
| `js-sys`                     | `0.3.77`  | MIT OR Apache-2.0                   |
| `lazy_static`                | `1.5.0`   | MIT OR Apache-2.0                   |
| `libc`                       | `0.2.170` | MIT OR Apache-2.0                   |
| `log`                        | `0.4.26`  | MIT OR Apache-2.0                   |
| `memchr`                     | `2.7.4`   | Unlicense OR MIT                    |
| `memmap2`                    | `0.9.5`   | MIT OR Apache-2.0                   |
| `once_cell`                  | `1.20.3`  | MIT OR Apache-2.0                   |
| `phf`                        | `0.11.3`  | MIT                                 |
| `phf_generator`              | `0.11.3`  | MIT                                 |
| `phf_macros`                 | `0.11.3`  | MIT                                 |
| `phf_shared`                 | `0.11.3`  | MIT                                 |
| `ppv-lite86`                 | `0.2.20`  | MIT/Apache-2.0                      |
| `proc-macro2`                | `1.0.93`  | MIT OR Apache-2.0                   |
| `prost`                      | `0.13.5`  | Apache-2.0                          |
| `prost-derive`               | `0.13.5`  | Apache-2.0                          |
| `quote`                      | `1.0.38`  | MIT OR Apache-2.0                   |
| `rand`                       | `0.8.5`   | MIT OR Apache-2.0                   |
| `rand_chacha`                | `0.3.1`   | MIT OR Apache-2.0                   |
| `rand_core`                  | `0.6.4`   | MIT OR Apache-2.0                   |
| `rayon`                      | `1.10.0`  | MIT OR Apache-2.0                   |
| `rayon-core`                 | `1.12.1`  | MIT OR Apache-2.0                   |
| `regex`                      | `1.11.1`  | MIT OR Apache-2.0                   |
| `regex-automata`             | `0.4.9`   | MIT OR Apache-2.0                   |
| `regex-syntax`               | `0.8.5`   | MIT OR Apache-2.0                   |
| `rustversion`                | `1.0.19`  | MIT OR Apache-2.0                   |
| `serde`                      | `1.0.218` | MIT OR Apache-2.0                   |
| `serde_derive`               | `1.0.218` | MIT OR Apache-2.0                   |
| `serde-wasm-bindgen`         | `0.5.0`   | MIT                                 |
| `siphasher`                  | `1.0.1`   | MIT/Apache-2.0                      |
| `snap`                       | `1.1.1`   | BSD-3-Clause                        |
| `strum`                      | `0.26.3`  | MIT                                 |
| `strum_macros`               | `0.26.4`  | MIT                                 |
| `syn`                        | `2.0.98`  | MIT OR Apache-2.0                   |
| `unicode-ident`              | `1.0.17`  | (MIT OR Apache-2.0) AND Unicode-3.0 |
| `wasm-bindgen`               | `0.2.100` | MIT OR Apache-2.0                   |
| `wasm-bindgen-backend`       | `0.2.100` | MIT OR Apache-2.0                   |
| `wasm-bindgen-macro`         | `0.2.100` | MIT OR Apache-2.0                   |
| `wasm-bindgen-macro-support` | `0.2.100` | MIT OR Apache-2.0                   |
| `wasm-bindgen-shared`        | `0.2.100` | MIT OR Apache-2.0                   |
| `web-sys`                    | `0.3.77`  | MIT OR Apache-2.0                   |
| `winnow`                     | `0.7.3`   | MIT                                 |
| `zerocopy`                   | `0.7.35`  | BSD-2-Clause OR Apache-2.0 OR MIT   |
| `zerocopy-derive`            | `0.7.35`  | BSD-2-Clause OR Apache-2.0 OR MIT   |

The parser build uses the committed `protobuf.rs`, `message_type.rs`, and
`maps.rs` at the pinned revision instead of cloning or generating from moving
game data. It also compiles native-only profiling clocks out of the isolated
`wasm32-unknown-unknown` copy. The submodule itself is never modified; all
adjustments are fail-closed and recorded in `public/parser/version.json`.

For each incorporated item, also retain the upstream copyright notice and any
source-header notice. Do not assume that a repository-wide software license
covers third-party game images stored in that repository; verify the individual
asset's provenance and Valve's applicable terms before distribution. A custom
or independently licensed Mirage radar should be preferred when provenance is
unclear.

## MIT license text

The following license text applies to MIT-licensed third-party software listed
above, subject to its own upstream copyright notice:

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## Valve notice

This project is not affiliated with, endorsed by, or sponsored by Valve
Corporation. Counter-Strike, Counter-Strike 2, Steam, and related marks and game
content are the property of their respective owners. No official Valve logos
are used.
