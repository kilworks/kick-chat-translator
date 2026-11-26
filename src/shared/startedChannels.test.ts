import { beforeEach, describe, expect, it } from 'vitest';
import { readStarted, setStarted } from './startedChannels';
import { vueDeChaine } from './channelLang';
import { defaultSettings } from './settings';

describe('channels started in this tab', () => {
  beforeEach(() => sessionStorage.clear());

  it('starts empty, remembers a started channel and forgets a stopped one', () => {
    expect([...readStarted()]).toEqual([]);
    setStarted('alpha', true);
    expect(readStarted().has('alpha')).toBe(true);
    setStarted('alpha', false);
    expect(readStarted().has('alpha')).toBe(false);
  });

  it('keeps other channels when one changes', () => {
    setStarted('alpha', true);
    setStarted('beta', true);
    setStarted('alpha', false);
    expect([...readStarted()]).toEqual(['beta']);
  });

  it('reads a corrupt value as empty', () => {
    sessionStorage.setItem('kt-started-channels', '{not json');
    expect([...readStarted()]).toEqual([]);
  });
});

describe('the view of a channel in manual mode', () => {
  const manual = { ...defaultSettings(), enabled: true, startMode: 'manual' as const };

  it('keeps today behaviour in automatic mode, started or not', () => {
    expect(vueDeChaine({ ...manual, startMode: 'auto' }, 'alpha').enabled).toBe(true);
    expect(vueDeChaine({ ...manual, startMode: 'auto' }, 'alpha', new Set()).enabled).toBe(true);
  });

  it('is off for a channel nobody started in this tab, on once it is started', () => {
    expect(vueDeChaine(manual, 'alpha', new Set()).enabled).toBe(false);
    expect(vueDeChaine(manual, 'alpha').enabled).toBe(false);
    expect(vueDeChaine(manual, 'alpha', new Set(['alpha'])).enabled).toBe(true);
    expect(vueDeChaine(manual, 'alpha', new Set(['beta'])).enabled).toBe(false);
  });

  it('still honours a pause on a started channel', () => {
    const paused = { ...manual, pausedChannels: ['alpha'] };
    expect(vueDeChaine(paused, 'alpha', new Set(['alpha'])).enabled).toBe(false);
  });

  it('leaves a page with no channel alone', () => {
    expect(vueDeChaine(manual, undefined, new Set()).enabled).toBe(true);
  });
});
