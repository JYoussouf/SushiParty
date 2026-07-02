import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirrors buildDirectionsUrl in src/lib/maps.ts — platform-aware directions
// deep links (Apple Maps on iOS, Google Maps elsewhere).

function buildDirectionsUrl(platform, destination, label) {
  const lat = destination.latitude;
  const lng = destination.longitude;
  if (platform === 'ios') {
    const q = label ? `&q=${encodeURIComponent(label)}` : '';
    return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d${q}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

const dest = { latitude: 43.6532, longitude: -79.3832 };

describe('buildDirectionsUrl', () => {
  it('uses Apple Maps on iOS with a driving flag', () => {
    const url = buildDirectionsUrl('ios', dest);
    assert.ok(url.startsWith('https://maps.apple.com/?daddr=43.6532,-79.3832'));
    assert.ok(url.includes('dirflg=d'));
  });

  it('labels the Apple Maps destination pin when a name is given', () => {
    const url = buildDirectionsUrl('ios', dest, 'Sushi & Roll');
    assert.ok(url.includes('&q=Sushi%20%26%20Roll'));
  });

  it('uses the Google Maps universal directions URL on Android', () => {
    const url = buildDirectionsUrl('android', dest);
    assert.equal(url, 'https://www.google.com/maps/dir/?api=1&destination=43.6532,-79.3832');
  });

  it('falls back to Google Maps on web', () => {
    const url = buildDirectionsUrl('web', dest, 'Ignored Label');
    assert.ok(url.startsWith('https://www.google.com/maps/dir/?api=1'));
    // web/Google URL does not encode the label into the destination
    assert.ok(!url.includes('Ignored'));
  });
});
