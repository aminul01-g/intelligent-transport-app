import { telemetryService } from '../telemetry.service';

// We need to bypass private modifiers to test the Haversine fallback directly.
const service = telemetryService as any;

describe('Telemetry Service - ETA Calculation', () => {
  it('should calculate ETA using Haversine formula and floor speed at 10 km/h', () => {
    // Distance between these two points is ~111 km (1 degree of latitude)
    const lat1 = 0;
    const lng1 = 0;
    const lat2 = 1;
    const lng2 = 0;

    // 1. With speed = 50 km/h
    // 111.19 km / 50 km/h = 2.2238 hours = ~8006 seconds
    const resultNormal = service.calculateHaversineETA(lat1, lng1, lat2, lng2, 50);
    expect(resultNormal.source).toBe('haversine');
    // Allow a small margin of error for rounding
    expect(resultNormal.etaSeconds).toBeGreaterThan(7900);
    expect(resultNormal.etaSeconds).toBeLessThan(8100);

    // 2. With speed = 2 km/h (should floor to 10 km/h)
    // 111.19 km / 10 km/h = 11.119 hours = ~40028 seconds
    const resultSlow = service.calculateHaversineETA(lat1, lng1, lat2, lng2, 2);
    expect(resultSlow.source).toBe('haversine');
    expect(resultSlow.etaSeconds).toBeGreaterThan(39000);
    expect(resultSlow.etaSeconds).toBeLessThan(41000);
    
    // Calculate the ratio to prove the 10km/h floor was used instead of 2km/h
    // If it used 2km/h, the ETA would be 5x longer (~200k seconds).
    // The ratio of normal (50km/h) to slow (floored to 10km/h) should be roughly 1:5.
    const ratio = resultSlow.etaSeconds / resultNormal.etaSeconds;
    expect(ratio).toBeCloseTo(5, 1);
  });
});
