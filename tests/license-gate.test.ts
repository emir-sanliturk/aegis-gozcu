import { describe, expect, it } from 'vitest';
import { evaluateSbomLicenses, spdxTokens } from '../scripts/license-gate.mjs';

const DENY_LIST = [
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'SSPL-1.0',
  'ELv2',
];

describe('CycloneDX SBOM License Gate', () => {
  it('tokenizes compound SPDX expressions without substring false positives', () => {
    expect(spdxTokens('MIT OR LGPL-3.0-only')).toEqual(['MIT', 'LGPL-3.0-only']);
    expect(spdxTokens('MIT AND Apache-2.0')).toEqual(['MIT', 'Apache-2.0']);
    expect(spdxTokens('(MIT OR GPL-3.0-or-later)')).toEqual(['MIT', 'GPL-3.0-or-later']);
  });

  it('allows permissive MIT, Apache-2.0, ISC, BSD-3-Clause, and non-denied LGPL-3.0-only', () => {
    const result = evaluateSbomLicenses(
      {
        components: [
          { name: 'fastify', version: '5.0.0', licenses: [{ license: { id: 'MIT' } }] },
          { name: 'three', version: '0.180.0', licenses: [{ license: { id: 'MIT' } }] },
          { name: 'typescript', version: '5.8.0', licenses: [{ license: { id: 'Apache-2.0' } }] },
          { name: 'some-lgpl-lib', version: '1.0.0', licenses: [{ license: { id: 'LGPL-3.0-only' } }] },
        ],
      },
      { deny: DENY_LIST, requireLicense: true }
    );

    expect(result.passed).toBe(true);
    expect(result.checkedCount).toBe(4);
    expect(result.violations).toEqual([]);
  });

  it('rejects GPL-3.0, AGPL-3.0, SSPL-1.0, ELv2, and compound expressions containing denied licenses', () => {
    const result = evaluateSbomLicenses(
      {
        components: [
          { name: 'bad-gpl', version: '1.0.0', licenses: [{ license: { id: 'GPL-3.0-only' } }] },
          { name: 'bad-agpl', version: '1.0.0', licenses: [{ license: { id: 'AGPL-3.0-or-later' } }] },
          { name: 'bad-sspl', version: '1.0.0', licenses: [{ license: { id: 'SSPL-1.0' } }] },
          { name: 'bad-elv2', version: '1.0.0', licenses: [{ license: { name: 'ELv2' } }] },
          { name: 'bad-expr', version: '1.0.0', licenses: [{ expression: '(MIT OR GPL-3.0-or-later)' }] },
        ],
      },
      { deny: DENY_LIST, requireLicense: true }
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(5);
    expect(result.violations.every((v) => v.reason === 'denied_license')).toBe(true);
  });

  it('rejects components without declared license when requireLicense is enabled', () => {
    const result = evaluateSbomLicenses(
      {
        components: [
          { name: 'unlicensed-pkg', version: '0.1.0', licenses: [] },
        ],
      },
      { deny: DENY_LIST, requireLicense: true }
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([
      { component: 'unlicensed-pkg', version: '0.1.0', reason: 'missing_license' },
    ]);
  });
});
