import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
// @ts-ignore
import { Agent, setGlobalDispatcher } from "undici";

// Load environment variables
dotenv.config();

// Override the default global undici fetch timeout (usually 30s) to 10 minutes (600,000ms)
// This completely resolves the "HeadersTimeoutError: Headers Timeout Error" in server-to-Gemini flows
try {
  setGlobalDispatcher(new Agent({
    headersTimeout: 600000,
    bodyTimeout: 600000,
    connectTimeout: 600000,
  }));
  console.log("Đã cấu hình lại Undici Global Dispatcher thành công (Thời hạn chờ: 10 phút)");
} catch (e) {
  console.warn("Không thể cấu hình Undici Global Dispatcher, bỏ qua:", e);
}

const app = express();
const PORT = 3000;

// Set up body parsers with spacious upload limits for ebooks
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper function to lazily initialize GoogleGenAI safely
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/**
 * Prepend a standard 44-byte WAV header to 16-bit, 24kHz mono PCM audio bytes.
 * This turns the raw PCM stream from Gemini TTS into a globally supported audio asset.
 */
function wrapPcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  
  const header = Buffer.alloc(44);
  
  // "RIFF" chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4); // File size - 8
  header.write("WAVE", 8);
  
  // "fmt " sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24);   // SampleRate
  header.writeUInt32LE(byteRate, 28);     // ByteRate
  header.writeUInt16LE(blockAlign, 32);   // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  
  // "data" sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40); // Chunk size
  
  return Buffer.concat([header, pcmBuffer]);
}

// Ensure api health endpoint is present and working
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    apiKeyConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// Helper to check if string contains printable text (and isn't binary like PDF)
function isPrintableText(str: string): boolean {
  let nonPrintableCount = 0;
  const checkLen = Math.min(str.length, 500);
  if (checkLen === 0) return false;
  
  for (let i = 0; i < checkLen; i++) {
    const code = str.charCodeAt(i);
    // Control characters (excluding tab, LF, CR)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintableCount++;
    }
  }
  return (nonPrintableCount / checkLen) < 0.15; // Increased allowance to 15% to support various UTF text streams safely
}

// Robust helper to decode text buffer handles UTF-16 LE, UTF-16 BE, and regular UTF-8 text files gracefully (common Windows Notepad exports)
function decodeTxtBuffer(buffer: Buffer): string {
  if (buffer.length >= 2) {
    // Check BOM for UTF-16 LE
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return buffer.toString("utf-16le");
    }
    // Check BOM for UTF-16 BE
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
      const swapped = Buffer.alloc(buffer.length);
      for (let i = 0; i < buffer.length - 1; i += 2) {
        swapped[i] = buffer[i + 1];
        swapped[i + 1] = buffer[i];
      }
      return swapped.toString("utf-16le");
    }
    // Check BOM for UTF-8
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return buffer.toString("utf-8");
    }
  }

  // Heuristic scan detection for UTF-16 LE without BOM
  let zeroCount = 0;
  const checkLen = Math.min(buffer.length, 500);
  for (let i = 1; i < checkLen; i += 2) {
    if (buffer[i] === 0) zeroCount++;
  }
  if (checkLen > 10 && (zeroCount / (checkLen / 2)) > 0.7) {
    return buffer.toString("utf-16le");
  }

  return buffer.toString("utf-8");
}


// Fallback regex-based layout or length segmentation of the text
function fallbackSplitBook(text: string, title: string = "Sách Mới"): any {
  // Common Vietnamese & English layout segmenters: Chương X, Chapter X, Phần X, Mục X
  const segmentRegex = /(?:^|\n)(Chương\s+\d+|Chapter\s+\d+|Phần\s+\d+|Mục\s+\d+|Chương\s+[I|V|X|L|C|D|M]+)\b/gi;
  
  const matches: { index: number; title: string }[] = [];
  let match;
  while ((match = segmentRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      title: match[1].trim()
    });
  }

  const chapters: any[] = [];
  if (matches.length === 0) {
    // Split into comfortable visual/narratable sizes (~1500 chars)
    const chunkSize = 1500;
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.substring(i, i + chunkSize);
      const chId = (chapters.length + 1).toString();
      chapters.push({
        id: chId,
        title: `Đoạn ${chId}`,
        content: chunk.trim()
      });
    }
  } else {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const rawContent = text.substring(start, end).trim();
      
      const lines = rawContent.split("\n");
      const markerTitle = lines[0].trim();
      const content = lines.slice(1).join("\n").trim();
      
      const chId = (i + 1).toString();
      chapters.push({
        id: chId,
        title: markerTitle || `Chương ${chId}`,
        content: content || rawContent
      });
    }
  }

  return {
    bookTitle: title,
    author: "Khuyết Danh",
    chapters: chapters
  };
}

// 1. POST /api/ebook/parse - Intelligent book segmenter & formatter with robust fallback
app.post("/api/ebook/parse", async (req: Request, res: Response): Promise<void> => {
  let activeText = req.body.textContent || "";
  const { fileData, fileType } = req.body;

  try {
    const ai = getAi();

    // Decode and parse text files natively on the server if they are uploaded as base64
    if (fileData) {
      try {
        const base64Data = fileData.split(",")[1] || fileData;
        const buffer = Buffer.from(base64Data, "base64");
        const decoded = decodeTxtBuffer(buffer);
        
        // Let's determine if this should be directly treated as text
        const isKnownTextMime = fileType && (
          fileType.includes("text") || 
          fileType.includes("txt") || 
          fileType.includes("csv") || 
          fileType.includes("json")
        );
        
        if (decoded && (isKnownTextMime || isPrintableText(decoded))) {
          activeText = decoded;
          console.log(`[Parser] Đổ mã tệp tin thành chuỗi văn bản thuần túy thành công (${activeText.length} ký tự).`);
        }
      } catch (e) {
        console.warn("[Parser] Bỏ qua lỗi giải mã tệp văn bản:", e);
      }
    }

    // PDF extraction helper: If we don't have text yet but have a binary file (PDF, docx, etc.), extract using Gemini 3.5-flash
    if (!activeText && fileData) {
      let mimeTypeForGemini = fileType || "application/pdf";
      try {
        // Build a robust mimetype identification
        if (mimeTypeForGemini === "text/plain" || mimeTypeForGemini.includes("text")) {
          // If a text helper fell through, it was parsed but didn't meet isPrintableText. Fallback.
          mimeTypeForGemini = "application/pdf";
        }
        
        console.log(`[Parser] Đang trích xuất văn bản từ tệp tin (${mimeTypeForGemini}) bằng AI trực tiếp...`);
        const base64Data = fileData.split(",")[1] || fileData;
        const textExtractResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            {
              inlineData: {
                mimeType: mimeTypeForGemini,
                data: base64Data,
              },
            },
            "Hãy trích xuất toàn bộ văn bản thực sự trong tài liệu này một cách trung thực nhất. Loại bỏ tiêu đề trang phụ, quảng cáo, mục sách nếu có. Trả về dưới dạng thuần văn bản tiếng Việt hoặc ngôn ngữ gốc của cuốn sách."
          ]
        });

        if (textExtractResponse.text && textExtractResponse.text.trim().length > 0) {
          activeText = textExtractResponse.text;
          console.log(`[Parser] Trích xuất văn bản từ tài liệu thành công (${activeText.length} ký tự).`);
        }
      } catch (pdfError: any) {
        console.error("[Parser] Thất bại khi trích xuất văn bản bằng Gemini:", pdfError.message || pdfError);
        
        res.status(400).json({ error: `Hệ thống AI không thể đọc được nội dung tệp này (${mimeTypeForGemini}). Vui lòng đảm bảo tệp không bị mã hóa, khóa mật khẩu, hoặc là tệp PDF dạng ảnh scan chưa được nhận diện chữ (OCR). Bạn có thể thử copy nội dung văn bản và dán trực tiếp. Chi tiết lỗi: ${pdfError.message || "Lỗi không xác định"}` });
        return;
      }
    }

    // Ensure we have some text to parse at this stage
    if (!activeText || activeText.trim().length === 0) {
      res.status(400).json({ error: "Không tìm thấy nội dung văn bản hợp lệ từ tệp hoặc đoạn văn dán vào. Vui lòng kiểm tra lại định dạng tệp." });
      return;
    }

    // Protect against out-of-token limit outputs (8192 tokens max is ~15k-20k words maximum output size of JSON)
    // If the text length is very high (e.g. over 60,000 characters =~ 12,000 words), running a full restructuring
    // will hit output token limit truncation and result in empty text or JSON parsing errors.
    // Instead, immediately fall back to high-performance local regex segmenting.
    if (activeText.length > 60000) {
      console.log(`[Parser] Tài liệu lớn (${activeText.length} kí tự) được chuyển thẳng qua hệ thống phân phân khúc regex nội bộ để tránh quá tải giới hạn token đầu ra của Gemini.`);
      
      // Attempt to extract title/author in a lightweight way
      let bookTitle = "Tài Liệu Chế Tác";
      const cleanedLines = activeText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (cleanedLines.length > 0 && cleanedLines[0].length < 80) {
        bookTitle = cleanedLines[0];
      }
      
      const fallbackBook = fallbackSplitBook(activeText, bookTitle);
      res.json(fallbackBook);
      return;
    }

    let geminiContentPayload = [{ text: `Here is the raw text to clean and segment into chapters:\n\n${activeText}` }];
    let systemPrompt = `You are a professional literary editor and book structurer. 
Your job is to read the provided text or document, extract its true title/author, clean up all formatting slop (headers, footers, page numbers, links, publisher notes, footnotes, navigation blocks), and divide it into balanced, beautifully narratable chapters/sections.

Constraint rules:
1. Each segment/chapter should contain a coherent chunk of content (ideally 800 to 2000 characters). This avoids overflowing Text-To-Speech limits.
2. Group consecutive short sections if appropriate.
3. Keep the content flow completely intact without skipping any actual story or informative book text.
4. Provide standard natural Vietnamese or original language titles.
5. Fix any noticeable paragraph break distortions caused by file parsing.

You MUST respond with a JSON object strictly matching this schema:
{
  "bookTitle": "Name of the Book",
  "author": "Author of the Book, or 'Unknown'",
  "chapters": [
    {
      "id": "1",
      "title": "Tên Chương 1",
      "content": "Nội dung đầy đủ đã được tinh chỉnh sạch sẽ của chương 1..."
    }
  ]
}`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: geminiContentPayload,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bookTitle: { type: Type.STRING },
              author: { type: Type.STRING },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                  required: ["id", "title", "content"],
                },
              },
            },
            required: ["bookTitle", "author", "chapters"],
          },
        },
      });

      if (!response || !response.text) {
        let debugReason = "Gemini returned empty response text.";
        if (response && response.candidates && response.candidates[0]) {
          const candidate = response.candidates[0];
          debugReason = `Finish reason: ${candidate.finishReason}`;
          if (candidate.finishMessage) {
            debugReason += `, message: ${candidate.finishMessage}`;
          }
        }
        throw new Error(`Zero response text received from Gemini processing. Details: ${debugReason}`);
      }

      const parsedBook = JSON.parse(response.text.trim());
      res.json(parsedBook);
    } catch (geminiError: any) {
      console.warn("[Parser] Trục trặc kết nối hoặc định dạng Gemini. Đang tự động kích hoạt bộ chế tác phân chương bằng Regex nội bộ...", geminiError.message || geminiError);
      
      // Since activeText is guaranteed to be present and non-empty, this fallback always succeeds!
      let bookTitle = "Bộ Sách Khép Kín";
      const cleanedLines = activeText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (cleanedLines.length > 0 && cleanedLines[0].length < 80) {
        bookTitle = cleanedLines[0];
      }
      
      const fallbackBook = fallbackSplitBook(activeText, bookTitle);
      res.json(fallbackBook);
    }
  } catch (error: any) {
    console.error("Book Parsing Error:", error);
    res.status(500).json({ error: error.message || "Failed to parse and structure the book." });
  }
});

// Helper to split text into coherent chunks for natural voice reading (max ~700 characters) to avoid API limit cutoffs
function splitTextIntoTtsChunks(text: string, maxChunkSize: number = 700): string[] {
  // Split using typical sentence delimiters, preserving punctuation
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|.+(\s+|$)/g) || [text];
  
  const chunks: string[] = [];
  let currentChunk = "";
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    if ((currentChunk + " " + trimmedSentence).length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      
      // If a single sentence is longer than maximum size, split it by words to keep safety
      if (trimmedSentence.length > maxChunkSize) {
        const words = trimmedSentence.split(/\s+/);
        let tempChunk = "";
        for (const word of words) {
          if ((tempChunk + " " + word).length > maxChunkSize) {
            chunks.push(tempChunk.trim());
            tempChunk = word;
          } else {
            tempChunk = tempChunk ? `${tempChunk} ${word}` : word;
          }
        }
        if (tempChunk) {
          currentChunk = tempChunk;
        }
      } else {
        currentChunk = trimmedSentence;
      }
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${trimmedSentence}` : trimmedSentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Helper to generate a single TTS audio chunk via Gemini API with retry logic
async function generateTtsChunk(
  ai: GoogleGenAI, 
  textChunk: string, 
  voiceName: string, 
  scene?: string, 
  sampleContext?: string, 
  speakingStyle?: string
): Promise<Buffer> {
  let instructionText = textChunk;
  let instructionsList: string[] = [];

  if (scene && scene.trim()) {
    instructionsList.push(`[Scene Environment: ${scene.trim()}]`);
  }
  if (sampleContext && sampleContext.trim()) {
    instructionsList.push(`[Sample Voice Context: ${sampleContext.trim()}]`);
  } else if (speakingStyle && speakingStyle.trim()) {
    instructionsList.push(`[Speaking Style & Tone: ${speakingStyle.trim()}]`);
  }

  if (instructionsList.length > 0) {
    instructionText = `${instructionsList.join("\n")}\n\nPlease read the following text exactly using the specified style, character, and scene background:\n${textChunk}`;
  } else {
    // Add a visible spacer to instruct the model not to clip, or just pad with a space.
    // We add a soft instruction to ensure it doesn't drop the first word.
    instructionText = `Please read the following text aloud exactly as written:\n${textChunk}`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text: instructionText }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName as any },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("No audio payload returned from Gemini TTS generation.");
  }

  return Buffer.from(base64Audio, "base64");
}

// 2. POST /api/ebook/tts - High performance TTS with custom audio packaging
app.post("/api/ebook/tts", async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, voiceName = "Kore", speakingStyle, scene, sampleContext } = req.body;
    
    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: "Text content for speech generation is required." });
      return;
    }

    const ai = getAi();

    // Dynamically split into small safe chunks to prevent cutting off or getting partial reads
    const chunks = splitTextIntoTtsChunks(text, 700);
    console.log(`[TTS] Đã tách cuốn sách/đoạn thành ${chunks.length} phần phụ để tránh tình trạng đọc dở dang (cắt trang).`);

    const pcmBuffers: Buffer[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[TTS] Đang chế tác âm thanh phần ${i + 1}/${chunks.length} (${chunks[i].length} ký tự)...`);
      let success = false;
      let lastError: any = null;
      let attempt = 0;

      while (attempt < 3 && !success) {
        attempt++;
        try {
          const chunkPcm = await generateTtsChunk(ai, chunks[i], voiceName, scene, sampleContext, speakingStyle);
          pcmBuffers.push(chunkPcm);
          success = true;
        } catch (err: any) {
          lastError = err;
          const errMsg = err.message || JSON.stringify(err);
          console.warn(`[TTS] Lỗi phần ${i + 1} lần ${attempt}:`, errMsg);
          
          if (errMsg.includes("429") || errMsg.includes("exceeded") || errMsg.includes("quota")) {
            throw new Error(`Bạn đã hết giới hạn tạo giọng đọc miễn phí (10 lượt/ngày của Gemini). Vui lòng cấu hình API Key riêng có trả phí trong mục Cài đặt hoặc thử lại vào ngày mai. Chi tiết: Quota Exceeded 429`);
          }
          
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // Cool-off delay
          }
        }
      }

      if (!success) {
        throw new Error(`Thất bại tại phần đọc số ${i + 1}/${chunks.length} sau 3 lần thử: ${lastError?.message || lastError}`);
      }
    }

    // Concatenate all 24kHz Mono 16-Bit Short PCM binary arrays together seamlessly
    const combinedPcm = Buffer.concat(pcmBuffers);
    
    // Wrap with Wav container header
    const wavBuffer = wrapPcmToWav(combinedPcm, 24000);

    // Return binary standard wav stream
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", wavBuffer.length);
    res.send(wavBuffer);
  } catch (error: any) {
    console.error("TTS Generation Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate audiobook speech files." });
  }
});

// 3. POST /api/ebook/polish - Content smart-phonetifier and text optimizer
app.post("/api/ebook/polish", async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, polishStyle } = req.body;
    if (!text) {
      res.status(400).json({ error: "Text parameter is required." });
      return;
    }

    const ai = getAi();
    
    let instructions = "";
    if (polishStyle === "vietnamese-slang") {
      instructions = "Rewrite standard abbreviations or English slang/tech terms into easy-to-pronounce format for a Vietnamese reader. Example: 'AI' becomes 'Trí tuệ nhân tạo' or 'Ei Ai', 'TTS' becomes 'Tổng hợp giọng nói' or 'Ti Ti ét', 'COVID' becomes 'Cô vít'. Preserve original meaning.";
    } else if (polishStyle === "smooth-pauses") {
      instructions = "Insert grammatical pauses, convert bullet points to natural connected sentences, and use descriptive punctuation (like commas, dashes, and periods) to control breath flow which makes audiobook reading sound highly lifelike and human.";
    } else {
      instructions = "Polish the prose of the text to read as a premium, high-quality, flowy book. Remove duplicate sentences, correct typing layouts, and make it read like natural literature.";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ text: `Original text:\n"${text}"\n\nApply these instructions:\n${instructions}` }],
      config: {
        systemInstruction: "You are a professional literary voice coach. Polish the given text for audio reading based on user specifications. Do not add metadata in output. Just return the clean polished narrative text."
      }
    });

    res.json({ polishedText: response.text?.trim() });
  } catch (error: any) {
    console.error("Polishing Error:", error);
    res.status(500).json({ error: error.message || "Failed to polish text." });
  }
});

// Vite middleware configuration for serving React applet
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Audiobook Creator Express server is listening on http://0.0.0.0:${PORT}`);
  });

  // Set comfortable socket layer timeouts (600,000ms = 10 minutes)
  server.timeout = 600000;
  server.headersTimeout = 600000;
  server.keepAliveTimeout = 600000;
}

startServer();
