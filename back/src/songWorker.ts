import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';

// Set the path to the ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function stitchVideos(
    videoPaths: string[],
    audioPath: string,
    outputPath: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!videoPaths || videoPaths.length === 0) {
            return reject(new Error('No video paths provided for stitching.'));
        }

        // Create a temporary text file listing all videos to concatenate
        const listFilePath = path.join(path.dirname(outputPath), `concat-list-${Date.now()}.txt`);
        const listContent = videoPaths.map(p => `file '${path.resolve(p).replace(/\\/g, '/')}'`).join('\n');

        try {
            console.log(`[songWorker] Concat list content:\n${listContent}`);
            fs.writeFileSync(listFilePath, listContent);
        } catch (err) {
            return reject(new Error(`Failed to write concat list file: ${err}`));
        }

        console.log(`[songWorker] Stitching ${videoPaths.length} videos with audio ${audioPath}...`);

        let command = ffmpeg()
            // Input 1: The concatenated video stream
            .input(listFilePath)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            // Input 2: The audio stream
            .input(audioPath);

        command
            .outputOptions([
                '-c:v', 'libx264',    // Re-encode to ensure uniform parameters
                '-pix_fmt', 'yuv420p', // Standard pixel format for maximum compatibility
                '-c:a', 'aac',        // Encode audio to AAC
                '-map', '0:v:0',      // Map the first input's video stream
                '-map', '1:a:0',      // Map the second input's audio stream
                '-movflags', '+faststart' // Fix "stuck" playback by moving metadata to start
            ])
            .save(outputPath)
            .on('end', () => {
                console.log(`[songWorker] Stitching complete! Saved to ${outputPath}`);
                // Cleanup temp list file
                try {
                    if (fs.existsSync(listFilePath)) {
                        fs.unlinkSync(listFilePath);
                    }
                } catch (e) {
                    console.warn(`[songWorker] Failed to cleanup list file: ${listFilePath}`);
                }
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error(`[songWorker] Error during stitching:`, err);
                reject(err);
            });
    });
}
