import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAB_KNOBS,
  labKnobsFromEnv,
  parseLabKnobs,
} from './lab-object';

describe('parseLabKnobs', () => {
  it('defaults when empty', () => {
    expect(parseLabKnobs(null)).toEqual(DEFAULT_LAB_KNOBS);
    expect(parseLabKnobs(undefined)).toEqual(DEFAULT_LAB_KNOBS);
    expect(parseLabKnobs({})).toEqual(DEFAULT_LAB_KNOBS);
  });

  it('accepts allowlisted pairs', () => {
    expect(parseLabKnobs({ hue: 'amber', shape: 'ring' })).toEqual({
      hue: 'amber',
      shape: 'ring',
    });
  });

  it('rejects HTML, SQL fragments and extra punctuation', () => {
    expect(parseLabKnobs({ hue: '<script>', shape: 'cube' })).toBeNull();
    expect(parseLabKnobs({ hue: 'cyan', shape: 'cube;drop' })).toBeNull();
    expect(parseLabKnobs({ hue: 'CYAN', shape: 'cube' })).toBeNull();
    expect(parseLabKnobs('cyan')).toBeNull();
    expect(parseLabKnobs({ hue: 'cyan<img>', shape: 'cube' })).toBeNull();
    expect(parseLabKnobs({ hue: "cyan';--", shape: 'bar' })).toBeNull();
    expect(parseLabKnobs({ hue: 'cyan', shape: '../../etc' })).toBeNull();
  });

  it('ignores extra keys', () => {
    expect(
      parseLabKnobs({ hue: 'rose', shape: 'bar', html: '<b>x</b>' }),
    ).toEqual({ hue: 'rose', shape: 'bar' });
  });
});

describe('labKnobsFromEnv', () => {
  it('falls back to defaults on garbage env', () => {
    expect(labKnobsFromEnv('nope', 'also-nope')).toEqual(DEFAULT_LAB_KNOBS);
    expect(labKnobsFromEnv('violet', undefined)).toEqual({
      hue: 'violet',
      shape: 'cube',
    });
  });
});
