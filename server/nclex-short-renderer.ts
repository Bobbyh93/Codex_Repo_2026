import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface RenderedShort {
  directory: string;
  filePath: string;
  cleanup: () => Promise<void>;
}

function wrapText(value: string, maxColumns: number) {
  const words = value.trim().replace(/\s+/g, " ").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= maxColumns) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

function runFfmpeg(args: string[]) {
  const executable = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let diagnostics = "";
    child.stderr.on("data", (chunk) => {
      diagnostics = `${diagnostics}${chunk}`.slice(-4_000);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${diagnostics}`));
    });
  });
}

function ffmpegPath(value: string) {
  return value.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export async function renderCaptionShort(input: {
  clipId: string;
  title: string;
  assetContent: string;
  keyword: string;
  cta: string;
}): Promise<RenderedShort> {
  const directory = join(tmpdir(), `nclex-short-${input.clipId}`);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });

  const titlePath = join(directory, "title.txt");
  const bodyPath = join(directory, "body.txt");
  const keywordPath = join(directory, "keyword.txt");
  const ctaPath = join(directory, "cta.txt");
  const outputPath = join(directory, `nclex-${input.clipId}.mp4`);
  await Promise.all([
    writeFile(titlePath, wrapText(input.title, 22), "utf8"),
    writeFile(bodyPath, wrapText(input.assetContent, 25), "utf8"),
    writeFile(keywordPath, wrapText(input.keyword.toUpperCase(), 20), "utf8"),
    writeFile(ctaPath, wrapText(input.cta, 28), "utf8"),
  ]);

  const filter = [
    "drawbox=x=70:y=110:w=940:h=170:color=0x102A43@0.96:t=fill",
    `drawtext=textfile='${ffmpegPath(titlePath)}':fontcolor=white:fontsize=64:line_spacing=16:x=(w-text_w)/2:y=145`,
    "drawbox=x=80:y=430:w=920:h=840:color=0xFFFFFF@0.10:t=fill",
    `drawtext=textfile='${ffmpegPath(bodyPath)}':fontcolor=white:fontsize=58:line_spacing=24:x=(w-text_w)/2:y=510`,
    "drawbox=x=150:y=1340:w=780:h=180:color=0x16A085@0.95:t=fill",
    `drawtext=textfile='${ffmpegPath(keywordPath)}':fontcolor=white:fontsize=62:x=(w-text_w)/2:y=1390`,
    `drawtext=textfile='${ffmpegPath(ctaPath)}':fontcolor=0xD9EAF7:fontsize=42:x=(w-text_w)/2:y=1630`,
    "drawbox=x=0:y=1885:w='iw*t/8':h=35:color=0x2DD4BF:t=fill",
    "format=yuv420p",
  ].join(",");

  try {
    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=0x071A2B:s=1080x1920:r=30:d=8",
      "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-vf", filter,
      "-t", "8", "-r", "30",
      "-c:v", "libx264", "-preset", "medium", "-crf", "20",
      "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart",
      outputPath,
    ]);
    return {
      directory,
      filePath: outputPath,
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
