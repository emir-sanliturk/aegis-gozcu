import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseArguments(argv) {
  const options = {
    sbom: '',
    deny: [],
    requireLicense: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--sbom') {
      options.sbom = argv[++index] ?? '';
    } else if (argument === '--deny') {
      options.deny = (argv[++index] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (argument === '--require-license') {
      options.requireLicense = true;
    }
  }

  if (!options.sbom) {
    throw new Error('--sbom is required');
  }

  return options;
}

function inferLicenseFromText(rawText) {
  const text = String(rawText ?? '');
  if (/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(text)) return 'AGPL-3.0-only';
  if (/GNU GENERAL PUBLIC LICENSE\s+Version 3/i.test(text)) return 'GPL-3.0-only';
  if (/Server Side Public License/i.test(text)) return 'SSPL-1.0';
  if (/Elastic License 2\.0/i.test(text)) return 'ELv2';
  if (
    /\bMIT License\b/i.test(text) ||
    /Permission is hereby granted, free of charge, to any person obtaining a copy/i.test(text)
  ) {
    return 'MIT';
  }
  if (/Apache License\s+Version 2\.0/i.test(text)) return 'Apache-2.0';
  if (/Permission to use, copy, modify, and\/or distribute this software for any purpose with or without fee/i.test(text)) {
    return 'ISC';
  }
  if (/Redistribution and use in source and binary forms, with or without modification/i.test(text)) {
    return 'BSD-3-Clause';
  }
  return '';
}

export function extractLicenses(component) {
  const licenses = component?.licenses ?? [];

  const direct = licenses.flatMap((entry) => {
    if (entry?.expression) {
      return [String(entry.expression).trim()];
    }
    if (entry?.license?.id) {
      return [String(entry.license.id).trim()];
    }
    if (entry?.license?.name) {
      return [String(entry.license.name).trim()];
    }
    return [];
  }).filter(Boolean);

  if (direct.length > 0) {
    return direct;
  }

  const evidenceLicenses = component?.evidence?.licenses ?? [];
  return evidenceLicenses.flatMap((entry) => {
    if (entry?.expression) {
      return [String(entry.expression).trim()];
    }
    if (entry?.license?.id) {
      return [String(entry.license.id).trim()];
    }
    const content = entry?.license?.text?.content;
    if (content) {
      const decoded = entry?.license?.text?.encoding === 'base64'
        ? Buffer.from(String(content), 'base64').toString('utf8')
        : String(content);
      const inferred = inferLicenseFromText(decoded);
      if (inferred) {
        return [inferred];
      }
    }
    return [];
  }).filter(Boolean);
}

export function spdxTokens(expression) {
  return String(expression)
    .split(/[\s()]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !['AND', 'OR', 'WITH'].includes(token.toUpperCase()));
}

/**
 * @param {{ components?: Array<Record<string, any>> }} sbom
 * @param {{ deny?: string[]; requireLicense?: boolean }} [options]
 */
export function evaluateSbomLicenses(sbom, options = {}) {
  const deny = options.deny ?? [];
  const requireLicense = options.requireLicense ?? false;
  const components = sbom?.components ?? [];
  const denySet = new Set(deny.map((d) => d.toLowerCase()));
  const violations = [];

  for (const component of components) {
    const licenses = extractLicenses(component);

    if (requireLicense && licenses.length === 0) {
      violations.push({
        component: component?.name ?? 'unknown',
        version: component?.version ?? 'unknown',
        reason: 'missing_license',
      });
      continue;
    }

    const deniedMatches = [];
    for (const lic of licenses) {
      const tokens = spdxTokens(lic);
      for (const token of tokens) {
        if (denySet.has(token.toLowerCase())) {
          deniedMatches.push(lic);
          break;
        }
      }
    }

    if (deniedMatches.length > 0) {
      violations.push({
        component: component?.name ?? 'unknown',
        version: component?.version ?? 'unknown',
        reason: 'denied_license',
        licenses: deniedMatches,
      });
    }
  }

  return {
    passed: violations.length === 0,
    checkedCount: components.length,
    violations,
  };
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const sbom = JSON.parse(fs.readFileSync(options.sbom, 'utf8'));
  const result = evaluateSbomLicenses(sbom, {
    deny: options.deny,
    requireLicense: options.requireLicense,
  });

  if (!result.passed) {
    console.error('License gate failed:');
    console.error(JSON.stringify(result.violations, null, 2));
    process.exit(1);
  }

  console.log(`License gate passed (${result.checkedCount} components checked).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
