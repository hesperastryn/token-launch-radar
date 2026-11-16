// The token radar's model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// What the board is. The ranked board holds protocols that record no token yet and pass the launch
// screen below: the snapshot's watchlist (the floor, every slug, always) plus every other pre-token
// protocol the screen passes, at any size — the early rows are the ones below the watchlist's floor.
// Protocols whose record already carries a token are never ranked: they are listed apart with the
// market's own value for them. Pre-token records that fail the screen (a bridge or staking product of
// a token that already trades, a versioned pool, an exchange) are listed apart too, with the reason:
// calling WBTC a token that does not exist yet would be the radar lying, and a radar that lies about
// its biggest row is worth nothing.
//
// The value model. A board's implied value is the entry's own claim: what a token would be worth if
// the protocol issued one on the record it has today. It is built only from the snapshot's figures:
//
//   implied = tvl_usd x category_multiple x growth_factor x maturity_factor x breadth_factor
//
// - category_multiple is calibrated from the snapshot itself: for every protocol whose token already
//   trades and whose record carries both a market cap and a TVL, take mcap / TVL, winsorized to
//   [0.005, 3] so one thin market cannot set a category's price; a category's multiple is its median
//   ratio, shrunk toward the whole market's median by the count behind it
//   (multiple = (n x median + 4 x global) / (n + 4)), so a category with two thin observations stays
//   near the market and one with fifteen stands on its own. No name is special-cased: the same
//   calibration runs on whatever snapshot the program is handed.
// - growth_factor answers the seven-day TVL change, clamped before it can shout: a +4,448% week in
//   the sealed data is a data quirk, not a valuation. 1 + 0.6 x clamp(change_7d, -50, 100) / 100;
//   an unreported change counts as 0.
// - maturity_factor rewards a record: a protocol that has run for years with no token has shown the
//   TVL is a business, not a campaign. 0.55 + 0.65 x min(age_days, 1460) / 1460; an unknown listing
//   date counts as the ranked set's median age, and the dashboard says so.
// - breadth_factor is a small reach premium for distribution: 1 + 0.02 x (min(chains, 10) - 1).
//
// The result is capped at 3x TVL (a launch priced above that is a claim about a mania, not a record)
// and floored at $1. Every factor is rounded to 4 decimals before the multiplication, and the
// dashboard prints the same rounded factors, so a reader can reproduce every row's value from the
// page: the screenshots and the code agree because they are the same numbers.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the board carries it. */
export const MODEL_VERSION = 'radar-2';

/** How many already-tokenised protocols the dashboard's Live view carries, by market cap. */
export const LIVE_ROWS = 36;

/** How many screened-out pre-token records the dashboard's Set aside view carries, by TVL. */
export const ASIDE_ROWS = 24;

/** The model's constants, printed on the dashboard so the page states the model it runs. */
export interface ModelConstants {
  shrink_k: number;
  ratio_floor: number;
  ratio_cap: number;
  growth_weight: number;
  growth_floor_pct: number;
  growth_cap_pct: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  breadth_per_chain: number;
  breadth_chain_cap: number;
  value_cap_x_tvl: number;
}

export const MODEL: ModelConstants = {
  shrink_k: 4,
  ratio_floor: 0.005,
  ratio_cap: 3,
  growth_weight: 0.6,
  growth_floor_pct: -50,
  growth_cap_pct: 100,
  maturity_floor: 0.55,
  maturity_range: 0.65,
  maturity_days: 1460,
  breadth_per_chain: 0.02,
  breadth_chain_cap: 10,
  value_cap_x_tvl: 3,
};

/** One category's calibration: the live ratios behind its multiple. */
export interface CategoryCalibration {
  category: string;
  live_count: number;
  median_ratio: number;
  multiple: number;
}

/** The calibration the model ran on this snapshot: global figures plus every category's row. */
export interface Calibration {
  live_count: number;
  global_median: number;
  categories: CategoryCalibration[];
}

/** Why a pre-token record is set aside instead of ranked, in the dashboard's words. */
export type AsideReason = 'wrapped-or-bridged' | 'staking-product' | 'exchange' | 'versioned-pool';

/** A farm step is one string: the action, then what it costs and how long it takes. */
export type FarmStep = string;

/** One row of board.json: the ranked board's row, with the model's working shown. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  on_watchlist: boolean;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_factor: number;
    maturity_factor: number;
    breadth_factor: number;
  };
  farm_steps: FarmStep[];
}

/** The dashboard's view of one ranked row: the board row's fields, farm plan included. */
export type RadarRow = BoardRow;

/** An already-tokenised protocol: it trades, so the page shows the market's value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  symbol: string | null;
}

/** A pre-token record the screen set aside, with the reason it is not a farm target. */
export interface AsideRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: AsideReason;
  reason_text: string;
}

/** Everything the dashboard renders, derived from the snapshot by the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  calibration: Calibration;
  counts: {
    protocols: number;
    pre_token: number;
    tokenised: number;
    watchlist: number;
    board: number;
    early: number;
    set_aside: number;
    median_age_days: number;
  };
  rows: RadarRow[];
  live: LiveRow[];
  aside: AsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

const bySlugAsc = (a: SnapshotProtocol, b: SnapshotProtocol): number => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list, computed on a sorted copy so the caller's order survives. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol's record carries no token: no market cap, no CoinGecko id, no symbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories whose pre-token records are products or venues of tokens that already trade. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge']);
const STAKING_CATEGORIES = new Set(['Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** A whole word wrapped, staked or staking anywhere in the name, in any case. */
const PRODUCT_NAME = /\b(wrapped|staked|staking)\b/i;

/** Names that begin with an exchange's name are that exchange's own product, not a launch candidate. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/**
 * Why a pre-token record is set aside, or null when it is a genuine launch candidate. The screen is
 * the watchlist's own logic with the TVL floor removed: it asks whether the record is a protocol
 * still waiting on a launch of its own, or a product of a token that already trades.
 */
export function asideReason(p: SnapshotProtocol): AsideReason | null {
  if (p.category === 'CEX' || EXCHANGE_PREFIXES.some((x) => p.name.startsWith(`${x} `) || p.name === x)) return 'exchange';
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return 'wrapped-or-bridged';
  if (p.category !== null && STAKING_CATEGORIES.has(p.category)) return 'staking-product';
  if (PRODUCT_NAME.test(p.name)) return 'staking-product';
  if (VERSIONED.test(p.name)) return 'versioned-pool';
  return null;
}

const ASIDE_TEXT: Record<AsideReason, string> = {
  'wrapped-or-bridged': 'A bridge or wrapped product of an asset that already trades: its value is that asset, and there is no launch of its own to farm.',
  'staking-product': 'A staking product of a token that already trades: the position earns the underlying token, not a future one.',
  exchange: 'An exchange or an exchange’s own product: not a protocol launch a farmer can qualify for.',
  'versioned-pool': 'A later version of a protocol whose line already exists: its token, if any, is the line’s, not a new launch.',
};

/**
 * The category multiples, calibrated from the snapshot's own live-token rows. Deterministic: ratios
 * are gathered in snapshot order, medians sort numerically, and the dashboard prints this table.
 */
export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const ratiosByCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = Math.min(model.ratio_cap, Math.max(model.ratio_floor, p.mcap_usd / p.tvl_usd));
    all.push(ratio);
    const key = p.category ?? 'Uncategorized';
    const list = ratiosByCategory.get(key);
    if (list === undefined) ratiosByCategory.set(key, [ratio]);
    else list.push(ratio);
  }
  const globalMedian = all.length > 0 ? median(all) : 0.2;
  const categories: CategoryCalibration[] = [...ratiosByCategory.entries()]
    .map(([category, ratios]) => {
      const med = median(ratios);
      const multiple = round4((ratios.length * med + model.shrink_k * globalMedian) / (ratios.length + model.shrink_k));
      return { category, live_count: ratios.length, median_ratio: round4(med), multiple };
    })
    .sort((a, b) => b.live_count - a.live_count || (a.category < b.category ? -1 : 1));
  return { live_count: all.length, global_median: round4(globalMedian), categories };
}

/** The multiple one category gets: its calibrated row, or the global median for a category with no live rows. */
function multipleFor(calibration: Calibration, category: string | null): number {
  const key = category ?? 'Uncategorized';
  const row = calibration.categories.find((c) => c.category === key);
  return row === undefined ? calibration.global_median : row.multiple;
}

/** The four factors and the implied value one protocol gets under `model` and `calibration`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  medianAge: number,
  calibration: Calibration,
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; growthPct: number; growthFactor: number; maturityFactor: number; breadthFactor: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const multiple = multipleFor(calibration, protocol.category);
  const growthPct = Math.min(model.growth_cap_pct, Math.max(model.growth_floor_pct, finite(protocol.change_7d, 0)));
  const growthFactor = round4(1 + model.growth_weight * (growthPct / 100));
  const ageForModel = age ?? medianAge;
  const maturityFactor = round4(model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range);
  const breadthFactor = round4(1 + model.breadth_per_chain * Math.max(0, Math.min(protocol.chains.length, model.breadth_chain_cap) - 1));
  const raw = protocol.tvl_usd * multiple * growthFactor * maturityFactor * breadthFactor;
  const capped = Math.min(raw, protocol.tvl_usd * model.value_cap_x_tvl);
  const implied = Math.max(1, Math.round(capped));
  return { implied, multiple, growthPct, growthFactor, maturityFactor, breadthFactor, age };
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  if (p.tvl_usd >= 10_000_000) return 75;
  return 50;
}

/** How long to hold, from the protocol's age: a young protocol's qualifying window runs longer. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's main action: what the farmer actually does first inside the protocol. */
function mainAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('cdp')) return `Deposit collateral into ${name} on ${chain} and mint its stablecoin against it, keeping the collateral ratio comfortably above the liquidation line.`;
  if (c.includes('lend') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} so the wallet is a real user of its market from the first week.`;
  if (c.includes('dex') || c.includes('swap')) return `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} and leave the position open.`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position so the account trades, not just sits.`;
  if (c.includes('risk curator') || c.includes('allocator') || c.includes('curator')) return `Deposit $${capital} into a ${name} curated vault on ${chain} and keep the vault shares in the wallet.`;
  if (c.includes('yield')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares rather than rotating out.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield asset on ${chain} through its own app and hold it in the wallet.`;
  if (c.includes('privacy')) return `Deposit $${capital} into ${name}'s shielded pool on ${chain} from the farm wallet, following its own deposit flow.`;
  if (c.includes('index')) return `Buy $${capital} of a ${name} index on ${chain} and hold the index token.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the position through a full funding cycle.`;
  if (c.includes('payment')) return `Fund the wallet with $${capital} and route a real payment through ${name} on ${chain}.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy to expiry.`;
  if (c.includes('option')) return `Deposit $${capital} into a ${name} options vault on ${chain} and hold through one full epoch.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} through its own app and keep the position open.`;
}

/** The category's second action: the behaviour that separates a farmer from a one-day visitor. */
function secondAction(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('cdp')) return `Repay part of the minted stablecoin and mint again a week later, so the wallet shows both sides of the CDP over time.`;
  if (c.includes('lend') || c.includes('collateral')) return `Borrow a small amount against the supply, keeping the health factor above 2, and repay it a week later: lenders reward wallets that use both sides.`;
  if (c.includes('dex') || c.includes('swap')) return `Swap a small amount through ${name}'s own router each week, so the wallet's volume is spread over time instead of landed in one day.`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Trade a second pair or resize the hedge once a week, keeping total exposure small and the account active across several funding periods.`;
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator')) return `Add a second, smaller deposit a fortnight later rather than one lump sum, so the wallet's history is a pattern, not an event.`;
  return `Come back a fortnight later and repeat the first action with a smaller amount, so the wallet's history is a pattern, not an event.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with its cost and its time, derived from the
 * protocol's own record (category, chains, TVL, age) by the same function for every row.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const steps: FarmStep[] = [
    `Set up a fresh wallet for ${p.name} and fund it on ${chain} with the chain's gas token plus the capital below; keep the seed phrase offline and never farm from a wallet that holds other positions. Cost: under $3 of gas to fund it. Time: 10 minutes.`,
    `${mainAction(p, capital, chain)} Cost: $${capital} of capital plus about $4 of gas. Time: 15 minutes to set up.`,
    `${secondAction(p, chain)} Cost: a few dollars of fees or interest at this size. Time: 10 minutes, twice in the first month.`,
  ];
  if (p.chains.length >= 3) {
    const second = p.chains[1]!;
    steps.push(
      `In week two, bridge a small amount to ${second} and repeat the main action there: ${p.name} runs on ${p.chains.length} chains, and multichain wallets are cheap breadth if a distribution counts them. Cost: about $5 of bridge and gas fees. Time: 20 minutes.`,
    );
  } else {
    steps.push(
      `Make one qualifying action every week — a deposit, a swap, a borrow or a vote — so the wallet's history spans several weekly snapshots instead of a single day. Cost: about $2 of gas a week. Time: 10 minutes a week.`,
    );
  }
  steps.push(
    `Hold the position for at least ${hold} days: distributions are measured from activity that stays, and a position closed inside the first week rarely counts. Cost: the $${capital} stays in the position for the whole window. Time: ${hold} days.`,
    `Once a week, read ${p.name}'s own announcements and its points or rewards page, reached only from the protocol's official site, and note any snapshot or eligibility post in a farm log with dates and transaction hashes. Cost: nothing, and never pay a third party to check eligibility. Time: 10 minutes a week.`,
    `When a token or a claim is announced, claim only from the link the protocol itself publishes, then decide the same week: hold the token as an investment or unwind the position and bank the result. Cost: claim gas of about $2–5 on ${chain}. Time: 30 minutes.`,
  );
  return steps;
}

/** The ranked board: every watchlist slug, plus every pre-token record the screen passes. */
export function buildBoard(snapshot: Snapshot, calibration: Calibration, medianAge: number, model: ModelConstants = MODEL): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isPreToken(p) && asideReason(p) === null) chosen.set(p.slug, p);
  }
  const watch = new Set(snapshot.watchlist);
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, medianAge, calibration, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || bySlugAsc(a.p, b.p));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    listed_at: s.p.listed_at,
    age_days: s.age,
    on_watchlist: watch.has(s.p.slug),
    implied_value_usd: s.implied,
    model: {
      category_multiple: s.multiple,
      growth_pct: s.growthPct,
      growth_factor: s.growthFactor,
      maturity_factor: s.maturityFactor,
      breadth_factor: s.breadthFactor,
    },
    farm_steps: farmSteps(s.p, s.age),
  }));
}

/** The already-tokenised protocols, by market cap: the market's own values, kept off the board. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || bySlugAsc(a, b))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      symbol: p.symbol,
    }));
}

/** The pre-token records the screen set aside, by TVL, each with its reason in words. */
export function asideRows(snapshot: Snapshot): AsideRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && asideReason(p) !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || bySlugAsc(a, b))
    .slice(0, ASIDE_ROWS)
    .map((p) => {
      const reason = asideReason(p)!;
      return { slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, reason, reason_text: ASIDE_TEXT[reason] };
    });
}

/** The median age of the ranked candidates: the age an unlisted date counts as. */
function medianAgeOf(snapshot: Snapshot): number {
  const ages: number[] = [];
  for (const p of snapshot.protocols) {
    if (!isPreToken(p) || asideReason(p) !== null) continue;
    const age = ageDays(snapshot.as_of, p.listed_at);
    if (age !== null) ages.push(age);
  }
  return ages.length > 0 ? Math.round(median(ages)) : 365;
}

/** Everything the dashboard renders, and the board the gate reads, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const calibration = calibrate(snapshot, model);
  const medianAge = medianAgeOf(snapshot);
  const board = buildBoard(snapshot, calibration, medianAge, model);
  const live = liveRows(snapshot);
  const aside = asideRows(snapshot);
  const preToken = snapshot.protocols.filter(isPreToken).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    calibration,
    counts: {
      protocols: snapshot.protocols.length,
      pre_token: preToken,
      tokenised: snapshot.protocols.length - preToken,
      watchlist: snapshot.watchlist.length,
      board: board.length,
      early: board.filter((r) => !r.on_watchlist).length,
      set_aside: snapshot.protocols.filter((p) => isPreToken(p) && asideReason(p) !== null).length,
      median_age_days: medianAge,
    },
    rows: board,
    live,
    aside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared value, farm steps, value bounds. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'a slug appears twice on the board';
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) if (!known.has(r.slug)) return `${r.slug} is not one of the snapshot's protocols`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
