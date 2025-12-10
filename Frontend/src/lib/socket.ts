import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Initialize Socket.IO connection
   */
  connect() {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });

    // Register all saved listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket?.on(event, callback as any);
      });
    });

    return this.socket;
  }

  /**
   * Disconnect Socket.IO connection
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('Socket.IO disconnected');
    }
  }

  /**
   * Subscribe to an event
   */
  on<T = any>(event: string, callback: (data: T) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.socket?.connected) {
      this.socket.on(event, callback as any);
    }
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }

    if (this.socket?.connected) {
      this.socket.off(event, callback as any);
    }
  }

  /**
   * Emit an event to the server
   */
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected. Event not sent:', event);
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Singleton instance
export const socketService = new SocketService();

// Event type definitions for type safety
export type SocketEvent = {
  'convoy.position.update': { convoyId: string; position: { lat: number; lng: number }; timestamp: Date };
  'convoy.checkpoint.cleared': { convoyId: string; checkpointId: string; location: { lat: number; lng: number }; timestamp: Date };
  'convoy.reroute': { convoyId: string; result: any; timestamp: Date };
  'convoy.status.update': { convoyId: string; status: string; timestamp: Date };
  'convoy.created': any;
  'event.triggered': { event: any; affectedConvoys: any[]; timestamp: Date };
  'event.status.update': { eventId: string; status: string; timestamp: Date };
  'risk.alert': { convoyId: string; riskScore: number; message: string };
  'conflict.detected': { conflicts: any[] };
  'optimizer.result': { convoyId: string; request: any; result: any; timestamp: Date };
  'optimization.approved': { requestId: string; convoyId: string; timestamp: Date };
};

/**
 * Type-safe event subscription
 */
export function subscribeToEvent<K extends keyof SocketEvent>(
  event: K,
  callback: (data: SocketEvent[K]) => void
) {
  socketService.on(event, callback);
  return () => socketService.off(event, callback);
}
