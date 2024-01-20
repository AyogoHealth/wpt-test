WPT Test Runner
===============

NodeJS test runner for web-platform-test testharness tests.

Usage
-----

```
npx wpt-test [FLAGS] TEST_DIR
```

wpt-test will use web-driver to run all of the tests found in `TEST_DIR` in a
browser and report their results. Tests must be HTML file containing
TestHarness.js test cases.

By default, tests will run against a temporary local server in Chrome. You can
customize the target run environment with the `--browser` flag.

Contributing
------------

Contributions of bug reports, feature requests, and pull requests are greatly
appreciated!

Please note that this project is released with a [Contributor Code of
Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to
abide by its terms.


Licence
-------

Test runner released under the [MIT Licence](LICENCE).
<br>
Web Platform Test testharness.js and related files released under the
[3-Clause BSD Licence](https://github.com/web-platform-tests/wpt/blob/master/LICENSE.md).

Copyright © 2023 Ayogo Health Inc.
