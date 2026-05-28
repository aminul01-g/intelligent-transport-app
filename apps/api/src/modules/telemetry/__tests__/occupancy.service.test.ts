import { calculateOccupancyLevel } from '../occupancy.service';

describe('Occupancy Service', () => {
  it('should return LOW if capacity is 0 to avoid division by zero', () => {
    expect(calculateOccupancyLevel(10, 0)).toBe('LOW');
  });

  it('should return LOW if ratio is less than 0.30', () => {
    expect(calculateOccupancyLevel(29, 100)).toBe('LOW');
    expect(calculateOccupancyLevel(0, 50)).toBe('LOW');
  });

  it('should return MEDIUM if ratio is exactly 0.30', () => {
    expect(calculateOccupancyLevel(30, 100)).toBe('MEDIUM');
  });

  it('should return MEDIUM if ratio is between 0.30 and 0.70', () => {
    expect(calculateOccupancyLevel(50, 100)).toBe('MEDIUM');
  });

  it('should return MEDIUM if ratio is exactly 0.70', () => {
    expect(calculateOccupancyLevel(70, 100)).toBe('MEDIUM');
  });

  it('should return HIGH if ratio is greater than 0.70', () => {
    expect(calculateOccupancyLevel(71, 100)).toBe('HIGH');
    expect(calculateOccupancyLevel(100, 100)).toBe('HIGH');
    expect(calculateOccupancyLevel(120, 100)).toBe('HIGH'); // Over capacity
  });
});
