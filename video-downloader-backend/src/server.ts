import { exec } from "child_process";
import cors from "cors";
import express, { Request, RequestHandler, Response } from "express";
import fs from 'fs-extra';
import path from "path";
import { promisify } from "util";

const execPromise = promisify(exec);
const PORT = 4000;
const app = express();

app.use(cors({
    origin: 'https://video-downloader-hazel-six.vercel.app', // Adjusted trailing slash
}));
app.use(express.json());

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
fs.ensureDirSync(DOWNLOAD_DIR);

interface InfoRequest { url: string; }
interface DownloadRequest { url: string; formatId: string; }

app.get("/", (req: Request, res: Response) => {
    res.send("Server is running perfectly on port 4000");
});

app.post('/api/video-info', (async (req: Request<{}, {}, InfoRequest>, res: Response) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
    }

    try {
        const ytDlpPath = process.env.VERCEL ? 'yt-dlp' : '/usr/bin/yt-dlp';
        const { stdout } = await execPromise(`${ytDlpPath} --dump-json "${url}"`);
        const output = JSON.parse(stdout);

        if (!output || !output.formats) {
            res.status(500).json({ error: "No formats found or invalid video" });
            return;
        }

        const formats = output.formats
            .filter((f: any) => f.vcodec !== 'none' && (f.height || f.format_note))
            .map((f: any) => {
                const resolution = f.height ? `${f.height}p` : (f.format_note || 'Unknown');
                return {
                    formatId: f.format_id,
                    resolution: resolution,
                    ext: f.ext === 'webm' ? 'mp4' : f.ext,
                    fps: f.fps ? `${f.fps}fps` : ''
                };
            });

        const uniqueFormats = formats
            .filter((value: any, index: number, self: any[]) =>
                index === self.findIndex((t) => t.resolution === value.resolution)
            )
            .sort((a: any, b: any) => parseInt(b.resolution) - parseInt(a.resolution));

        res.json({
            title: output.title,
            thumbnail: output.thumbnail,
            formats: uniqueFormats
        });

    } catch (error) {
        console.error('Error fetching info:', error);
        res.status(500).json({ error: 'Failed to fetch video details' });
    }
}) as RequestHandler);


app.post('/api/download', (async (req: Request<{}, {}, DownloadRequest>, res: Response) => {
    const { url, formatId } = req.body;

    if (!url || !formatId) {
        res.status(400).json({ error: 'URL and formatId are required' });
        return;
    }

    const outputFilename = `video_${Date.now()}.mp4`;
    const outputPath = path.join(DOWNLOAD_DIR, outputFilename);

    try {
        const ytDlpPath = process.env.VERCEL ? 'yt-dlp' : '/usr/bin/yt-dlp';
        const cmd = `${ytDlpPath} -f "${formatId}+bestaudio/best" --merge-output-format mp4 --no-check-certificates "${url}" -o "${outputPath}"`;
        await execPromise(cmd);

        // Explicitly typed 'err: any' to fix TS7006 error
        res.download(outputPath, 'downloaded_video.mp4', async (err: any) => {
            if (err) console.error('Error sending file:', err);
            await fs.remove(outputPath).catch(e => console.error(e));
        });

    } catch (error) {
        await fs.remove(outputPath).catch(e => console.error(e));
        res.status(500).json({ error: 'Download processing failed' });
    }
}) as RequestHandler);

// Vercel deployment 
export default app;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}