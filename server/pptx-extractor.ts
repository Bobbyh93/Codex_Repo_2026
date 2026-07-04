import JSZip from "jszip";

export interface ExtractedPptxSlide {
  slideNumber: number;
  title: string;
  text: string;
  notes: string;
  sourcePath: string;
  notesPath?: string;
}

export interface ExtractedPptxContent {
  text: string;
  slideCount: number;
  speakerNotesCount: number;
  slides: ExtractedPptxSlide[];
}

function decodeXmlText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)));
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractTextRuns(xml: string) {
  const matches = Array.from(xml.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g));
  return compactText(matches.map((match) => decodeXmlText(match[1])).join(" "));
}

function partNumber(fileName: string, pattern: RegExp) {
  const match = fileName.match(pattern);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function titleFromSlideText(text: string, slideNumber: number) {
  const firstLine = compactText(text).split(/(?<=[.!?])\s+|\n/)[0] || "";
  return firstLine.slice(0, 90) || `Slide ${slideNumber}`;
}

export async function extractPptxContent(buffer: Buffer | Uint8Array): Promise<ExtractedPptxContent> {
  const zip = await JSZip.loadAsync(buffer);
  const slidePattern = /^ppt\/slides\/slide(\d+)\.xml$/;
  const notesPattern = /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/;
  const slideFiles = Object.values(zip.files)
    .filter((file) => !file.dir && slidePattern.test(file.name))
    .sort((a, b) => partNumber(a.name, slidePattern) - partNumber(b.name, slidePattern));
  const notesByNumber = new Map<number, JSZip.JSZipObject>();

  for (const file of Object.values(zip.files)) {
    if (!file.dir && notesPattern.test(file.name)) {
      notesByNumber.set(partNumber(file.name, notesPattern), file);
    }
  }

  const slides: ExtractedPptxSlide[] = [];
  for (const slideFile of slideFiles) {
    const slideNumber = partNumber(slideFile.name, slidePattern);
    const slideXml = await slideFile.async("string");
    const slideText = extractTextRuns(slideXml);
    const notesFile = notesByNumber.get(slideNumber);
    const notesText = notesFile ? extractTextRuns(await notesFile.async("string")) : "";
    const title = titleFromSlideText(slideText || notesText, slideNumber);
    const lines = [
      `Slide ${slideNumber}: ${title}`,
      slideText ? `Visible slide text: ${slideText}` : "",
      notesText ? `Speaker notes: ${notesText}` : "",
    ].filter(Boolean);

    slides.push({
      slideNumber,
      title,
      text: slideText,
      notes: notesText,
      sourcePath: slideFile.name,
      notesPath: notesFile?.name,
    });
  }

  const text = slides
    .map((slide) => [
      `Slide ${slide.slideNumber}: ${slide.title}`,
      slide.text ? `Visible slide text: ${slide.text}` : "",
      slide.notes ? `Speaker notes: ${slide.notes}` : "",
    ].filter(Boolean).join("\n"))
    .join("\n\n");

  return {
    text,
    slideCount: slides.length,
    speakerNotesCount: slides.filter((slide) => Boolean(slide.notes)).length,
    slides,
  };
}
