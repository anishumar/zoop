import ffmpeg from 'fluent-ffmpeg';
import { StorageService } from '../services/storage.service';
import prisma from '../prisma/client';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Generate a thumbnail for a video URL using FFmpeg, upload to R2, and update the LiveSession database.
 */
export async function generateThumbnailBackground(videoUrl: string, sessionId: string, userId: string) {
  try {
    console.log(`[Thumbnail] Starting extraction for session ${sessionId} from ${videoUrl}`);

    // Create a temporary file path
    const tempFilename = `thumb-${sessionId}-${Date.now()}.jpg`;
    const tempFilePath = path.join(os.tmpdir(), tempFilename);
    const s3Key = `thumbnails/${userId}/${sessionId}.jpg`;

    // Extract frame at 2 seconds
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(videoUrl)
        .inputOptions(['-ss 00:00:02']) // Seek before input to optimize fetching chunk
        .outputOptions([
          '-frames:v 1',   // Only one frame
          '-q:v 2'         // High quality
        ])
        .output(tempFilePath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    console.log(`[Thumbnail] Extracted to ${tempFilePath}, uploading to R2...`);

    // Read the file buffer
    const buffer = fs.readFileSync(tempFilePath);
    
    // Upload to R2
    await StorageService.uploadBuffer(s3Key, buffer, 'image/jpeg');

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    // Build public URL and update database
    const publicUrl = StorageService.buildPublicUrl(s3Key);
    console.log(`[Thumbnail] Successfully uploaded to ${publicUrl}`);

    await prisma.liveSession.update({
      where: { id: sessionId },
      data: { thumbnailUrl: publicUrl }
    });

    console.log(`[Thumbnail] Database updated for session ${sessionId}`);

  } catch (err: any) {
    console.error(`[Thumbnail] Failed to generate thumbnail for session ${sessionId}:`, err);
  }
}
