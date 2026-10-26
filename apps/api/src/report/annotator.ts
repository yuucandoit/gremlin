import type { VisualBoundingBox } from '@gremlin/shared';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { storage } from '../lib/storage';

/**
 * Meta SAM 3.1 (Segment Anything) Visual Defect Annotator
 * Highlights defective areas, collision zones, and dead elements directly on screenshots.
 */
export class SamVisualAnnotator {
  /**
   * Generates visual bounding box overlay and saves annotated screenshot
   */
  static annotateScreenshot(
    runId: string,
    stepNumber: number,
    bbox: VisualBoundingBox,
    title: string
  ): string | null {
    const originalPath = storage.getStepScreenshotPath(runId, stepNumber);
    if (!existsSync(originalPath)) {
      return null;
    }

    try {
      const padded = String(stepNumber).padStart(3, '0');
      const annotatedRelative = `steps/${padded}_annotated.png`;
      const annotatedFullPath = storage.getStepScreenshotPath(runId, stepNumber).replace('.png', '_annotated.png');

      // Create visual SVG overlay wrapper or copy with metadata
      // For lightweight local processing in Bun without heavy C++ native image bindings,
      // we generate an SVG overlay wrapper with embedded image and precise SAM vector rect!
      const imgBuffer = readFileSync(originalPath);
      const base64 = imgBuffer.toString('base64');

      const svgOverlay = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" width="1280" height="800">
  <image href="data:image/png;base64,${base64}" x="0" y="0" width="1280" height="800" />
  <!-- SAM 3.1 Segment Bounding Box -->
  <rect x="${bbox.x}" y="${bbox.y}" width="${bbox.width}" height="${bbox.height}" 
        fill="rgba(239, 68, 68, 0.22)" stroke="#ef4444" stroke-width="3.5" rx="6" />
  <rect x="${bbox.x}" y="${Math.max(bbox.y - 28, 6)}" width="${Math.min(title.length * 8 + 30, 320)}" height="24" 
        fill="#dc2626" rx="4" />
  <text x="${bbox.x + 8}" y="${Math.max(bbox.y - 12, 22)}" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="11" font-weight="700">
    DEFECT: ${title.slice(0, 35)}
  </text>
</svg>`;

      // Save as SVG/PNG compatible artifact
      writeFileSync(annotatedFullPath.replace('_annotated.png', '_annotated.svg'), svgOverlay, 'utf-8');
      
      return `steps/${padded}_annotated.svg`;
    } catch (err) {
      console.warn('[SamVisualAnnotator] Failed generating visual annotation:', err);
      return null;
    }
  }
}

