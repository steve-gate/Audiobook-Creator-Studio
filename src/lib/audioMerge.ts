export async function mergeWavBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) {
    throw new Error("Không có file âm thanh nào để ghép.");
  }
  
  const buffers = await Promise.all(blobs.map(b => b.arrayBuffer()));
  
  let totalDataLength = 0;
  for (let i = 0; i < buffers.length; i++) {
    // Assuming standard 44-byte WAV header from Gemini TTS
    totalDataLength += (buffers[i].byteLength - 44);
  }

  const resultBuffer = new ArrayBuffer(44 + totalDataLength);
  const resultView = new DataView(resultBuffer);
  const resultData = new Uint8Array(resultBuffer);

  // Copy header from first buffer
  const firstHeader = new Uint8Array(buffers[0].slice(0, 44));
  resultData.set(firstHeader, 0);

  // Update total file size in RIFF chunk
  resultView.setUint32(4, 36 + totalDataLength, true);
  // Update data length in data chunk
  resultView.setUint32(40, totalDataLength, true);

  let offset = 44;
  for (let i = 0; i < buffers.length; i++) {
    const pcmData = new Uint8Array(buffers[i].slice(44));
    resultData.set(pcmData, offset);
    offset += pcmData.byteLength;
  }

  return new Blob([resultBuffer], { type: 'audio/wav' });
}
