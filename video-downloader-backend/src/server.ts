import { exec } from "child_process";
import cors from "cors";
import express, { Request, Response } from "express";
import fs from 'fs-extra';
import path from "path";
import { promisify } from "util";

const execPromise = promisify(exec);
const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors({
    origin: ['http://localhost:5173', "https://video-downloader-backend-1-wzho.onrender.com"],
}));
app.use(express.json());

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
fs.ensureDirSync(DOWNLOAD_DIR);

interface InfoRequest { url: string; }
interface DownloadRequest { url: string; formatId: string; }

app.get("/", (req: Request, res: Response) => {
    res.send("Server is running perfectly on port 4000");
});


app.post('/api/video-info', async (req: Request<{}, {}, InfoRequest>, res: Response): Promise<any> => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        const cmd = `/usr/bin/yt-dlp --user-agent "${userAgent}" --dump-json "${url}"`;
        
        const { stdout } = await execPromise(cmd);
        const output = JSON.parse(stdout);

        if (!output || !output.formats) {
            return res.status(500).json({ error: "No formats found or invalid video" });
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

    } catch (error: any) {
        console.error('--- YT-DLP INFO ERROR LOG ---');
        console.error(error.stderr || error.message);
        console.error('-----------------------------');
        res.status(500).json({ error: 'Failed to fetch video details' });
    }
});


app.post('/api/download', async (req: Request<{}, {}, DownloadRequest>, res: Response): Promise<any> => {
    const { url, formatId } = req.body;

    if (!url || !formatId) {
        return res.status(400).json({ error: 'URL and formatId are required' });
    }

    const outputFilename = `video_${Date.now()}.mp4`;
    const outputPath = path.join(DOWNLOAD_DIR, outputFilename);

    try {
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        
        const cmd = `/usr/bin/yt-dlp --user-agent "${userAgent}" -f "${formatId}+bestaudio/best" --merge-output-format mp4 --no-check-certificates "${url}" -o "${outputPath}"`;
        await execPromise(cmd);

        res.download(outputPath, 'downloaded_video.mp4', async (err) => {
            if (err) console.error('Error sending file:', err);
            await fs.remove(outputPath).catch(e => console.error(e));
        });

    } catch (error: any) {
        console.error('--- YT-DLP DOWNLOAD ERROR LOG ---');
        console.error(error.stderr || error.message);
        console.error('---------------------------------');
        await fs.remove(outputPath).catch(e => console.error(e));
        res.status(500).json({ error: 'Download processing failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});