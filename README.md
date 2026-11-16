# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/hesperastryn/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/hesperastryn/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over a sealed DefiLlama snapshot of 758 protocols. It ranks the protocols that record no token by an implied value calibrated from the snapshot's own live tokens — each category's market-cap-to-TVL multiple, shrunk toward the market median — adjusted for seven-day growth, years run without a token, and chains reached; every ranked protocol carries a concrete farm plan with a cost and a time on each step, and the wrapped, bridged and exchange-issued look-alikes are set aside with their reasons rather than ranked as launches.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=9sbzt2n6&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
