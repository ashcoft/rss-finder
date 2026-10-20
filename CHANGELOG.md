# 1.0.0 (2026-10-20)


### Bug Fixes

* base html ([6510772](https://github.com/ashcoft/rss-finder/commit/65107728104e199ca3174cb18481bd8f0d82e42f))
* better api msg ([c15b1b2](https://github.com/ashcoft/rss-finder/commit/c15b1b20b45c274faa4d50e1cf294df1cacf7448))
* check if the href of the <a> is valid ([efcce46](https://github.com/ashcoft/rss-finder/commit/efcce4679bf3d96bfe2145783fc12d03d791ec57))
* **ci:** gate releases on CI and harden the release job ([3262265](https://github.com/ashcoft/rss-finder/commit/3262265e1021796294f9f310b4bf623dc0e00bca))
* **ci:** pin checkout and setup-node by SHA in the release job ([7accfbf](https://github.com/ashcoft/rss-finder/commit/7accfbf1fdb72e9d1f9760d6b64e770aee977382))
* **ci:** pin pnpm/action-setup by SHA in the release workflow ([bcb0e93](https://github.com/ashcoft/rss-finder/commit/bcb0e931266c6ee15f9c12567cb0df98fac6bfaf))
* **ci:** release via a reusable workflow instead of workflow_run ([a526893](https://github.com/ashcoft/rss-finder/commit/a5268933f49c40fb6822a10a9c4210f54224315c))
* complete url scheme ([437c598](https://github.com/ashcoft/rss-finder/commit/437c598dbf0d4555a05ec47508b93c971e057aad))
* correct URL scheme, non-ASCII feed URLs and astral entities ([3b8619d](https://github.com/ashcoft/rss-finder/commit/3b8619dda29cda5ab1f6887cf2e6bb940c7f193f)), closes [#128512](https://github.com/ashcoft/rss-finder/issues/128512)
* detect schemes without slashes and keep legacy feed links working ([e14194a](https://github.com/ashcoft/rss-finder/commit/e14194abce9d51b66ce17b97a86aac79f266c72d))
* fix build step ([56337cf](https://github.com/ashcoft/rss-finder/commit/56337cf66ea32b06293f7a0a832b4bd1815b156e))
* fix yaml ([6202ae7](https://github.com/ashcoft/rss-finder/commit/6202ae70452b292940100dc07d93534dd617131e))
* format rel link to abs ([456a205](https://github.com/ashcoft/rss-finder/commit/456a20515f7a14268abbfbc9d894990d7f1de923))
* normalize url ([2794cf1](https://github.com/ashcoft/rss-finder/commit/2794cf189c17600eed775703fba5c3164274f87b))
* package.json & pnpm-lock.yaml to reduce vulnerabilities ([80d0658](https://github.com/ashcoft/rss-finder/commit/80d0658d6a96e5a5e4cd29f3fa38997d6014cd62))
* read http body multiple times ([2fbd47e](https://github.com/ashcoft/rss-finder/commit/2fbd47e1b92870a2855ec013a775638721f4f8cf))
* reject non-string URLs without leaking an internal error ([1b63fb7](https://github.com/ashcoft/rss-finder/commit/1b63fb77c7cfbe52d86370dc05d32bf9447eb66b))
* return 400 for a malformed request body in find-feeds ([fc71130](https://github.com/ashcoft/rss-finder/commit/fc71130aea70e4cb67d2928c3d8ff3ef3788513c))
* update actions/setup-go ([45f4de0](https://github.com/ashcoft/rss-finder/commit/45f4de0997d77ebe050315709f58d0799106d4fc))


### Features

* add autofocus for input ([4416b93](https://github.com/ashcoft/rss-finder/commit/4416b9337ff0a0cae8da06862f973370d4f68150))
* add umami script ([482c4d6](https://github.com/ashcoft/rss-finder/commit/482c4d6bceb09a59b9aeb5a6eb3a1cf4f41ab843))
* add url icon in table ([5c2a4f0](https://github.com/ashcoft/rss-finder/commit/5c2a4f0e7f26226711c29c54205d1e41bfa60641))
* avoid ssrf ([a831bd8](https://github.com/ashcoft/rss-finder/commit/a831bd8cbd557822782971274d9bb8cfa0dd6324))
* find <a> with rss word ([ce5b49e](https://github.com/ashcoft/rss-finder/commit/ce5b49ea6663983e63e3ec09f00970c93e715df3))
* publish releases with semantic-release ([16dfcdb](https://github.com/ashcoft/rss-finder/commit/16dfcdb8c457aa5b1fce65357738414d5596216d))
* remove content-type check, add search under url root ([9f7959a](https://github.com/ashcoft/rss-finder/commit/9f7959abc844d073dd1ea5b869f19daa4b04c758))
* support github feed ([391e76f](https://github.com/ashcoft/rss-finder/commit/391e76fddb474ebd1cabf2050d9ed8065b4d8385))
* support reddit and update github ([c527174](https://github.com/ashcoft/rss-finder/commit/c52717438d59e3a86d3e7b3c3fb12ffaefd99de1))
* support youtube channel and playlist ([b8958a1](https://github.com/ashcoft/rss-finder/commit/b8958a110f4343e27518b1178672a13714bba500))
