type StreamController = ReadableStreamDefaultController<Uint8Array>;

class BrowserStreamManager {
  private activeStreams = new Map<string, Set<StreamController>>();
  private latestFrames = new Map<string, Uint8Array>();
  private activeUrls = new Map<string, string>();

  setCurrentUrl(runId: string, url: string): void {
    this.activeUrls.set(runId, url);
  }

  getCurrentUrl(runId: string): string | undefined {
    return this.activeUrls.get(runId);
  }

  broadcastFrame(runId: string, base64Data: string): void {
    const buffer = Uint8Array.from(Buffer.from(base64Data, 'base64'));
    this.latestFrames.set(runId, buffer);

    const clients = this.activeStreams.get(runId);
    if (!clients || clients.size === 0) return;

    const frameHeader = `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${buffer.length}\r\n\r\n`;
    const frameHeaderBytes = new TextEncoder().encode(frameHeader);
    const frameTrailerBytes = new TextEncoder().encode('\r\n');

    // Combine header + jpeg bytes + trailer
    const combined = new Uint8Array(
      frameHeaderBytes.length + buffer.length + frameTrailerBytes.length
    );
    combined.set(frameHeaderBytes, 0);
    combined.set(buffer, frameHeaderBytes.length);
    combined.set(frameTrailerBytes, frameHeaderBytes.length + buffer.length);

    for (const controller of clients) {
      try {
        controller.enqueue(combined);
      } catch (err) {
        // Client might have disconnected
        clients.delete(controller);
      }
    }
  }

  registerClient(runId: string, controller: StreamController): () => void {
    if (!this.activeStreams.has(runId)) {
      this.activeStreams.set(runId, new Set());
    }
    const set = this.activeStreams.get(runId)!;
    set.add(controller);

    // Send latest frame immediately if available so client doesn't see a blank screen
    const latest = this.latestFrames.get(runId);
    if (latest) {
      const frameHeader = `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${latest.length}\r\n\r\n`;
      const frameHeaderBytes = new TextEncoder().encode(frameHeader);
      const frameTrailerBytes = new TextEncoder().encode('\r\n');
      const combined = new Uint8Array(
        frameHeaderBytes.length + latest.length + frameTrailerBytes.length
      );
      combined.set(frameHeaderBytes, 0);
      combined.set(latest, frameHeaderBytes.length);
      combined.set(frameTrailerBytes, frameHeaderBytes.length + latest.length);

      try {
        controller.enqueue(combined);
      } catch {
        set.delete(controller);
      }
    }

    return () => {
      set.delete(controller);
      if (set.size === 0) {
        this.activeStreams.delete(runId);
      }
    };
  }

  getLatestFrame(runId: string): Uint8Array | undefined {
    return this.latestFrames.get(runId);
  }

  endStream(runId: string): void {
    const clients = this.activeStreams.get(runId);
    if (clients) {
      for (const controller of clients) {
        try {
          controller.close();
        } catch {}
      }
      this.activeStreams.delete(runId);
    }
  }
}

export const streamManager = new BrowserStreamManager();
