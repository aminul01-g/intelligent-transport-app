import { fareService } from './fare.service';
import { RouteStop, PassengerCategory } from '@transport/shared-types';

describe('FareService', () => {
  const mockStops: RouteStop[] = [
    { id: 'stop1', route_id: 'r1', stop_name: 'A', latitude: '0', longitude: '0', sequence_order: 1, distance_from_previous_km: '0', estimated_travel_time_seconds: 0 },
    { id: 'stop2', route_id: 'r1', stop_name: 'B', latitude: '0', longitude: '0', sequence_order: 2, distance_from_previous_km: '2.5', estimated_travel_time_seconds: 0 },
    { id: 'stop3', route_id: 'r1', stop_name: 'C', latitude: '0', longitude: '0', sequence_order: 3, distance_from_previous_km: '3.0', estimated_travel_time_seconds: 0 },
  ];

  describe('calculateRouteDistance', () => {
    it('should calculate distance correctly between stops', () => {
      const dist = fareService.calculateRouteDistance('stop1', 'stop3', mockStops);
      expect(dist).toBe(5.5);
    });

    it('should throw if boarding is after alighting', () => {
      expect(() => {
        fareService.calculateRouteDistance('stop3', 'stop1', mockStops);
      }).toThrow('INVALID_STOP_ORDER');
    });

    it('should throw if stop does not exist', () => {
      expect(() => {
        fareService.calculateRouteDistance('stop1', 'stop99', mockStops);
      }).toThrow('INVALID_STOP_ID');
    });
  });

  describe('calculateFare', () => {
    it('should calculate base fare correctly', () => {
      const result = fareService.calculateFare({
        allStops: mockStops,
        boardingStopId: 'stop1',
        alightingStopId: 'stop3',
        basePricePerKm: 2,
        fareRule: null,
        boardingTime: new Date('2026-05-29T10:00:00Z'),
      });
      // distance 5.5 * 2 = 11.00
      expect(result.finalPrice).toBe(11.00);
      expect(result.discountApplied).toBe(false);
      expect(result.surchargeApplied).toBe(false);
    });

    it('should apply peak hour surcharge correctly', () => {
      // Mock local hour to be exactly 10
      const mockDate = new Date('2026-05-29T10:00:00Z');
      mockDate.getHours = () => 10;
      
      const result = fareService.calculateFare({
        allStops: mockStops,
        boardingStopId: 'stop1',
        alightingStopId: 'stop3',
        basePricePerKm: 2,
        fareRule: {
          id: 'rule1', route_id: 'r1', passenger_category: PassengerCategory.REGULAR,
          discount_percentage: '0', fixed_price: null, peak_hour_surcharge_pct: '20',
          peak_start_hour: 8, peak_end_hour: 12, is_active: true, created_at: ''
        },
        boardingTime: mockDate,
      });
      // 11 * 1.2 = 13.20
      expect(result.finalPrice).toBe(13.20);
      expect(result.surchargeApplied).toBe(true);
    });

    it('should return minimum fare if calculated fare is too low', () => {
      const result = fareService.calculateFare({
        allStops: mockStops,
        boardingStopId: 'stop1',
        alightingStopId: 'stop2',
        basePricePerKm: 1, // dist 2.5 * 1 = 2.5
        fareRule: null,
        boardingTime: new Date(),
      });
      expect(result.finalPrice).toBe(5.00);
    });
  });
});
