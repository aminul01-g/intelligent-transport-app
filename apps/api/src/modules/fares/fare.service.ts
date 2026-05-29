import { RouteStop, FareRule, PassengerCategory } from '@transport/shared-types';
import { db } from '../../db';
import { AppError } from '../../errors/AppError';

export interface CalculateFareParams {
  allStops: RouteStop[];
  boardingStopId: string;
  alightingStopId: string;
  basePricePerKm: number;
  fareRule: FareRule | null;
  boardingTime: Date;
}

export interface CalculatedFare {
  distanceKm: number;
  baseFare: number;
  discountApplied: boolean;
  surchargeApplied: boolean;
  finalPrice: number;
  ruleId: string | null;
}

class FareService {
  /**
   * Calculates the total distance between a boarding stop and an alighting stop
   * based on the sequential array of all route stops.
   *
   * Pure function: does not perform any database queries.
   */
  calculateRouteDistance(
    boardingStopId: string,
    alightingStopId: string,
    allStops: RouteStop[],
  ): number {
    const boardingIndex = allStops.findIndex((s) => s.id === boardingStopId);
    const alightingIndex = allStops.findIndex((s) => s.id === alightingStopId);

    if (boardingIndex === -1 || alightingIndex === -1) {
      throw AppError.badRequest('INVALID_STOP_ID'); // Ensure stops exist
    }

    if (boardingIndex >= alightingIndex) {
      throw AppError.badRequest('INVALID_STOP_ORDER');
    }

    // Slice includes stops the passenger passes through, starting right after boarding
    const stopsPassed = allStops.slice(boardingIndex + 1, alightingIndex + 1);
    
    let totalDistanceKm = 0;
    for (const stop of stopsPassed) {
      totalDistanceKm += parseFloat(stop.distance_from_previous_km);
    }

    // Round to 4 decimal places to match NUMERIC(8,4)
    return Math.round(totalDistanceKm * 10000) / 10000;
  }

  /**
   * Calculates the final fare for a trip.
   *
   * Pure function: receives all necessary data as parameters.
   */
  calculateFare(params: CalculateFareParams): CalculatedFare {
    const {
      allStops,
      boardingStopId,
      alightingStopId,
      basePricePerKm,
      fareRule,
      boardingTime,
    } = params;

    // Step 1: Calculate route distance
    const distanceKm = this.calculateRouteDistance(boardingStopId, alightingStopId, allStops);

    // Step 2: Check for fixed price override
    if (fareRule?.fixed_price != null) {
      const finalPrice = parseFloat(fareRule.fixed_price);
      return {
        distanceKm,
        baseFare: finalPrice,
        discountApplied: false,
        surchargeApplied: false,
        finalPrice,
        ruleId: fareRule.id,
      };
    }

    // Step 3: Base fare
    const baseFare = distanceKm * basePricePerKm;

    // Step 4: Apply discount
    const discountPercentage = parseFloat(fareRule?.discount_percentage ?? '0');
    const discountedFare = baseFare * (1 - discountPercentage / 100);
    const discountApplied = discountPercentage > 0;

    // Step 5: Apply peak hour surcharge
    let finalPrice = discountedFare;
    let surchargeApplied = false;

    if (fareRule?.peak_start_hour != null && fareRule?.peak_end_hour != null) {
      const hour = boardingTime.getHours();
      const start = fareRule.peak_start_hour;
      const end = fareRule.peak_end_hour;

      let isPeak = false;
      if (start <= end) {
        isPeak = hour >= start && hour <= end;
      } else {
        // Wrap-around case (e.g., 22:00 to 06:00)
        isPeak = hour >= start || hour <= end;
      }

      if (isPeak) {
        const surchargePct = parseFloat(fareRule.peak_hour_surcharge_pct);
        finalPrice = discountedFare * (1 + surchargePct / 100);
        surchargeApplied = true;
      }
    }

    // Step 6: Minimum fare floor
    finalPrice = Math.max(finalPrice, 5.00);

    // Step 7: Round to 2 decimal places
    finalPrice = Math.round(finalPrice * 100) / 100;

    return {
      distanceKm,
      baseFare,
      discountApplied,
      surchargeApplied,
      finalPrice,
      ruleId: fareRule?.id ?? null,
    };
  }

  /**
   * Asynchronously calculates the estimated maximum fare for a given route
   * starting from a specific boarding stop, to the end of the route.
   */
  async getEstimatedMaxFare(
    routeId: string,
    boardingStopId: string,
    passengerCategory: PassengerCategory,
    boardingTime: Date,
  ): Promise<number> {
    // 1. Fetch route stops ordered by sequence
    const { rows: allStops } = await db.query<RouteStop>(
      `SELECT * FROM route_stops WHERE route_id = $1 ORDER BY sequence_order ASC`,
      [routeId],
    );

    if (allStops.length === 0) {
      throw AppError.notFound('Route stops not found');
    }

    // 2. Fetch base price per km
    const { rows: routeRows } = await db.query<{ base_price_per_km: string }>(
      `SELECT base_price_per_km FROM routes WHERE id = $1`,
      [routeId],
    );

    const routeRow = routeRows[0];
    if (!routeRow) {
      throw AppError.notFound('Route not found');
    }

    const basePricePerKm = parseFloat(routeRow.base_price_per_km);

    // 3. Fetch applicable fare rule
    const { rows: ruleRows } = await db.query<FareRule>(
      `
      SELECT * FROM fare_rules
      WHERE route_id = $1 AND passenger_category = $2 AND is_active = true
      LIMIT 1
      `,
      [routeId, passengerCategory],
    );

    const fareRule = ruleRows[0] ?? null;

    // 4. Calculate fare to the last stop
    const lastStop = allStops[allStops.length - 1];
    if (!lastStop) throw AppError.notFound('Route stops not found');
    const lastStopId = lastStop.id;

    if (boardingStopId === lastStopId) {
      return 5.00; // Minimum fare if boarding at the last stop
    }

    const result = this.calculateFare({
      allStops,
      boardingStopId,
      alightingStopId: lastStopId,
      basePricePerKm,
      fareRule,
      boardingTime,
    });

    return result.finalPrice;
  }
}

export const fareService = new FareService();
