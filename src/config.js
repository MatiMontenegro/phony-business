// Central tunables. Change the game's name or feel here.
export const GAME = {
  title: 'Phony Business',
  version: '0.2.0',
};

export const TUNE = {
  // movement (m/s)
  walkSpeed: 2.6,
  runSpeed: 5.2,
  accel: 14,
  airControl: 0.35,
  jumpVel: 5.6,
  gravity: -20,
  tackleSpeed: 4.4, // sprinting faster than this into someone knocks them over

  // bodily functions (fraction per second)
  bladderRate: 1 / 150,
  bladderWaterBoost: 0.22,
  bladderCoffeeBoost: 0.3,
  gasRate: 1 / 55,
  gasBeansBoost: 0.45,
  smallFartCost: 0.14,
  bigFartMin: 0.35,
  peeDuration: 3.6, // seconds to empty a full bladder
  publicPeeFine: 25,
  accidentFine: 50,

  // ragdoll
  ragdollMinTime: 1.6,
  ragdollMaxTime: 6,
  slipSpeed: 1.8,

  // shift
  shiftSeconds: 360,
  quotaBase: 1400,
  quotaPerExtraPlayer: 900,
  quotaGrowth: 1.35,

  // switchboard: phones ring at random desks
  ringEvery: [4, 9],
  ringTimeout: 24,
  maxRings: 4,
  silenceNudge: 24,

  // data entry
  voucherTTL: 90,
  secretPrice: 150,

  // desks
  sitRadius: 1.0,
};

// Collision groups for Rapier (membership << 16 | filter)
export const GROUP = {
  STATIC: 1 << 0,
  CHAR: 1 << 1,
  RAGDOLL: 1 << 2,
  PROP: 1 << 3,
  PROJECTILE: 1 << 4,
};

export function groups(membership, filter) {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}
