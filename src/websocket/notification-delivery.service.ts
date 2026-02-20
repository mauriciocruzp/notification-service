import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * In-memory map: recipient (string) -> Set of socket ids.
 * For multiple NestJS instances, use Redis adapter so emit reaches the right instance.
 */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private readonly userSockets = new Map<string, Set<string>>();
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  register(recipient: string, socketId: string): void {
    let set = this.userSockets.get(recipient);
    if (!set) {
      set = new Set();
      this.userSockets.set(recipient, set);
    }
    set.add(socketId);
    this.logger.debug(`Socket ${socketId} registered for recipient ${recipient}`);
  }

  unregister(socketId: string, recipient?: string): void {
    if (recipient != null) {
      const set = this.userSockets.get(recipient);
      if (set) {
        set.delete(socketId);
        if (set.size === 0) this.userSockets.delete(recipient);
      }
      return;
    }
    for (const [rec, set] of this.userSockets) {
      if (set.has(socketId)) {
        set.delete(socketId);
        if (set.size === 0) this.userSockets.delete(rec);
        return;
      }
    }
  }

  emitToUser(recipient: string, event: string, payload: unknown): void {
    if (!this.server) return;
    const socketIds = this.userSockets.get(recipient);
    if (!socketIds?.size) {
      this.logger.debug(`No sockets found for recipient ${recipient}`);
      return;
    }
    for (const id of socketIds) {
      const socket = this.server.sockets.sockets.get(id);
      if (socket) {
        socket.emit(event, payload);
        this.logger.debug(`Emitted ${event} to socket ${id} for recipient ${recipient}`);
      }
    }
  }
}
