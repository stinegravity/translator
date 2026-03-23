import { describe, it, expect } from 'vitest';
import { getTierLimits, isTierAtLeast, TIER_LIMITS } from '../server/src/config/tiers';

describe('getTierLimits', () => {
  it('returns correct limits for each tier', () => {
    expect(getTierLimits('FREE').charsPerDay).toBe(500);
    expect(getTierLimits('PRO').charsPerDay).toBe(10_000);
    expect(getTierLimits('TEAM').charsPerDay).toBe(50_000);
    expect(getTierLimits('ENTERPRISE').charsPerDay).toBe(-1);
  });

  it('returns FREE limits for unknown tier', () => {
    expect(getTierLimits('UNKNOWN' as never)).toEqual(TIER_LIMITS.FREE);
  });

  it('PRO enables conversations but not exports', () => {
    const pro = getTierLimits('PRO');
    expect(pro.conversationsEnabled).toBe(true);
    expect(pro.exportEnabled).toBe(false);
    expect(pro.apiAccess).toBe(false);
  });

  it('TEAM enables exports and API access', () => {
    const team = getTierLimits('TEAM');
    expect(team.exportEnabled).toBe(true);
    expect(team.apiAccess).toBe(true);
  });
});

describe('isTierAtLeast', () => {
  it('FREE is at least FREE', () => {
    expect(isTierAtLeast('FREE', 'FREE')).toBe(true);
  });

  it('FREE is not at least PRO', () => {
    expect(isTierAtLeast('FREE', 'PRO')).toBe(false);
  });

  it('PRO is at least FREE', () => {
    expect(isTierAtLeast('PRO', 'FREE')).toBe(true);
  });

  it('ENTERPRISE is at least every tier', () => {
    expect(isTierAtLeast('ENTERPRISE', 'FREE')).toBe(true);
    expect(isTierAtLeast('ENTERPRISE', 'PRO')).toBe(true);
    expect(isTierAtLeast('ENTERPRISE', 'TEAM')).toBe(true);
    expect(isTierAtLeast('ENTERPRISE', 'ENTERPRISE')).toBe(true);
  });

  it('TEAM is at least PRO but not ENTERPRISE', () => {
    expect(isTierAtLeast('TEAM', 'PRO')).toBe(true);
    expect(isTierAtLeast('TEAM', 'ENTERPRISE')).toBe(false);
  });
});
