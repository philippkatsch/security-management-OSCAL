import { describe, it, expect } from 'vitest';
import { formatProse } from '../../lib/oscal-formatting';

describe('oscal-formatting formatProse', () => {
  it('returns empty string for null, undefined, or empty prose', () => {
    expect(formatProse(null)).toBe('');
    expect(formatProse(undefined)).toBe('');
    expect(formatProse('')).toBe('');
  });

  it('returns plain prose unchanged when no parameter placeholders exist', () => {
    const prose = 'This is a standard requirement without parameters.';
    expect(formatProse(prose, [])).toBe(prose);
  });

  it('formats single value parameter correctly', () => {
    const prose = 'Enforce policy every {{ insert: param, ac-1_prm_1 }} days.';
    const params = [{ id: 'ac-1_prm_1', values: ['30'] }];
    expect(formatProse(prose, params)).toBe('Enforce policy every 30 days.');
  });

  it('joins multi-value parameter arrays with comma-space (R3-02)', () => {
    const prose = 'Allowed ciphers: {{ insert: param, ciphers }}.';
    const params = [{ id: 'ciphers', values: ['TLS 1.2', 'TLS 1.3', 'IPsec'] }];
    expect(formatProse(prose, params)).toBe('Allowed ciphers: TLS 1.2, TLS 1.3, IPsec.');
  });

  it('correctly handles and renders numeric 0 without falling back to label (R3-02)', () => {
    const prose = 'Max retries allowed: {{ insert: param, retry_count }}.';
    const params = [{ id: 'retry_count', label: 'Retry Count', values: [0] }];
    expect(formatProse(prose, params)).toBe('Max retries allowed: 0.');
  });

  it('correctly handles and renders string "0" without falling back to label (R3-02)', () => {
    const prose = 'Offset value: {{ insert: param, offset }}.';
    const params = [{ id: 'offset', label: 'Offset', values: ['0'] }];
    expect(formatProse(prose, params)).toBe('Offset value: 0.');
  });

 it('correctly handles and renders boolean false without falling back to label (R3-02)', () => {
 const prose = 'Debug mode active: {{ insert: param, is_debug }}.';
 const params = [{ id: 'is_debug', label: 'Debug Flag', values: [false] }];
 expect(formatProse(prose, params)).toBe('Debug mode active: false.');
 });

 it('falls back to parameter label when values is null, undefined, or empty array', () => {
 const prose = 'Must review every {{ insert: param, p1 }}.';
 expect(formatProse(prose, [{ id: 'p1', label: 'Review Frequency', values: null }])).toBe('Must review every [Review Frequency].');
 expect(formatProse(prose, [{ id: 'p1', label: 'Review Frequency', values: undefined }])).toBe('Must review every [Review Frequency].');
 expect(formatProse(prose, [{ id: 'p1', label: 'Review Frequency', values: [] }])).toBe('Must review every [Review Frequency].');
 expect(formatProse(prose, [{ id: 'p1', label: 'Review Frequency', values: ['', ' ', null] }])).toBe('Must review every [Review Frequency].');
 });

 it('falls back to [param-id] when parameter has no values and no label', () => {
 const prose = 'Must review every {{ insert: param, p1 }}.';
 expect(formatProse(prose, [{ id: 'p1', values: [] }])).toBe('Must review every [p1].');
 });

 it('falls back to [param-id] when parameter is not in params list', () => {
 const prose = 'Unknown parameter {{ insert: param, non_existent }}.';
 expect(formatProse(prose, [])).toBe('Unknown parameter [non_existent].');
 });

 it('supports profile set-parameters format with param-id key', () => {
 const prose = 'Configured baseline: {{ insert: param, baseline_name }}.';
 const params = [{ 'param-id': 'baseline_name', values: ['NIST-High'] }];
 expect(formatProse(prose, params)).toBe('Configured baseline: NIST-High.');
 });

 it('handles whitespace variations inside insert parameter tokens', () => {
 const prose = 'Values: {{insert:param,p1}} and {{ insert: param , p2 }} and {{ insert: param, p3 }}.';
 const params = [
 { id: 'p1', values: ['A'] },
 { id: 'p2', values: ['B'] },
 { id: 'p3', values: ['C'] }
 ];
 expect(formatProse(prose, params)).toBe('Values: A and B and C.');
 });

 it('formats multiple parameters in a single sentence', () => {
 const prose = 'Transfer between {{ insert: param, min_rate }} and {{ insert: param, max_rate }} MB/s.';
 const params = [
 { id: 'min_rate', values: ['10'] },
 { id: 'max_rate', values: ['100'] }
 ];
 expect(formatProse(prose, params)).toBe('Transfer between 10 and 100 MB/s.');
 });

 it('supports params passed as a Record<string, unknown> dictionary', () => {
 const prose = 'Between {{ insert: param, min }} and {{ insert: param, max }}.';
 const paramsMap = {
 min: 0,
 max: ['50', '100']
 };
 expect(formatProse(prose, paramsMap)).toBe('Between 0 and 50, 100.');
 });
});
