import { Socket } from 'socket.io';
import { z } from 'zod';
import { LiveBusPayload } from '@transport/shared-types';
import { driverNs, passengerNs } from '../../realtime';
import { telemetryService } from './telemetry.service';
import { incidentService } from '../incidents/incident.service';
import { cache } from '../../cache';

// ──────────────────────────────────────────────
// Validation Schemas
// ──────────────────────────────────────────────

const LocationUpdateSchema = z.object({
  shiftId: z.string().uuid(),
  // Bangladesh geographical bounds
  lat: z.number().min(20.5).max(26.7), 
  lng: z.number().min(88.0).max(92.7),
  speed: z.number().min(0),
  heading: z.number().int().min(0).max(360).optional(),
  passengerCount: z.number().int().min(0),
});

const BreakdownSignalSchema = z.object({
  shiftId: z.string().uuid(),
});

const TrackBusSchema = z.object({
  routeId: z.string().uuid(),
});

// ──────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────

export function initTelemetryGateway(): void {
  // ── 1. Redis → Socket.IO Bridge ──
  //
  // Subscribes to the wildcard 'bus:live:*' channel. When a live bus payload
  // is published by any API instance (via telemetryService.ingestLocation),
  // this bridge picks it up and broadcasts it to all connected passengers
  // tracking that route.
  //
  // It also maintains the 'bus:positions:{routeId}' cache used by the
  // getLatestPositions() API.
  cache.psubscribe('bus:live:*', async (channel, message) => {
    // channel format: "bus:live:{routeId}"
    const routeId = channel.split(':')[2];
    if (!routeId) return;

    const payload = message as LiveBusPayload;

    // Broadcast to passenger namespace room
    passengerNs.to(`route:${routeId}`).emit('bus:position', payload);

    // Maintain the active positions cache (TTL 60s)
    const cacheKey = `bus:positions:${routeId}`;
    try {
      const existing = (await cache.get<Record<string, LiveBusPayload>>(cacheKey)) || {};
      existing[payload.shiftId] = payload;
      await cache.set(cacheKey, existing, 60);
    } catch (err) {
      console.error('[GATEWAY] Error updating positions cache:', err);
    }
  }).catch(err => {
    console.error('[GATEWAY] Failed to setup Redis subscriber bridge:', err);
  });

  // ── 2. Driver Namespace Handlers ──
  driverNs.on('connection', (socket: Socket) => {
    socket.on('location:update', async (payload: unknown) => {
      try {
        const data = LocationUpdateSchema.parse(payload);
        await telemetryService.ingestLocation(data);
      } catch (err) {
        if (err instanceof z.ZodError) {
          socket.emit('error', { message: 'Validation failed', details: err.errors });
        } else {
          socket.emit('error', { message: 'Failed to process location' });
          console.error('[GATEWAY] location:update error:', err);
        }
      }
    });

    socket.on('breakdown:signal', async (payload: unknown) => {
      try {
        const data = BreakdownSignalSchema.parse(payload);
        await incidentService.createBreakdown(data.shiftId);
      } catch (err) {
        if (err instanceof z.ZodError) {
          socket.emit('error', { message: 'Validation failed', details: err.errors });
        } else {
          socket.emit('error', { message: 'Failed to process breakdown signal' });
          console.error('[GATEWAY] breakdown:signal error:', err);
        }
      }
    });
  });

  // ── 3. Passenger Namespace Handlers ──
  passengerNs.on('connection', (socket: Socket) => {
    socket.on('track:bus', (payload: unknown) => {
      try {
        const data = TrackBusSchema.parse(payload);
        const room = `route:${data.routeId}`;
        socket.join(room);
        console.log(`[SOCKET] Passenger ${socket.id} tracking route ${data.routeId}`);
      } catch (err) {
        if (err instanceof z.ZodError) {
          socket.emit('error', { message: 'Validation failed', details: err.errors });
        } else {
          socket.emit('error', { message: 'Failed to track bus' });
        }
      }
    });

    socket.on('untrack:bus', () => {
      // Leave all route-specific rooms
      for (const room of socket.rooms) {
        if (room.startsWith('route:')) {
          socket.leave(room);
          console.log(`[SOCKET] Passenger ${socket.id} untracked ${room}`);
        }
      }
    });
  });

  console.log('[GATEWAY] Telemetry gateway initialized');
}
