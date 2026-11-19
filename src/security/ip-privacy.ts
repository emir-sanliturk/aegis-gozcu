export interface IpPrivacyPolicy {
  collectPreciseIp: false;
  storeRawIp: false;
  hashIpForAbuseControl: true;
  proxyEgress: true;
}

export async function hashClientIpForAbuseControl(
  rawIp: string,
  pepper: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${pepper}:${rawIp}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export const defaultIpPrivacyPolicy: IpPrivacyPolicy = {
  collectPreciseIp: false,
  storeRawIp: false,
  hashIpForAbuseControl: true,
  proxyEgress: true,
};
