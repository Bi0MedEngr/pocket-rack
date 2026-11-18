/**
 * Constants for Demucs model
 */
const CONSTANTS = {
  SAMPLE_RATE: 44100,
  FFT_SIZE: 4096,
  HOP_SIZE: 1024,
  TRAINING_SAMPLES: 343980,
  MODEL_SPEC_BINS: 2048,
  MODEL_SPEC_FRAMES: 336,
  SEGMENT_OVERLAP: 0.25,
  TRACKS: ['drums', 'bass', 'other', 'vocals'],

  // Default model URL (Hugging Face Hub)
  DEFAULT_MODEL_URL: 'https://huggingface.co/timcsy/demucs-web-onnx/resolve/main/htdemucs_embedded.onnx'
};

/**
 * Fast FFT/iFFT implementation using Cooley-Tukey radix-2 algorithm
 */

const fftTwiddles = new Map();
const ifftTwiddles = new Map();
const hannWindows = new Map();

function getFFTTwiddles(n) {
  if (fftTwiddles.has(n)) return fftTwiddles.get(n);
  const real = new Float32Array(n / 2);
  const imag = new Float32Array(n / 2);
  for (let k = 0; k < n / 2; k++) {
    const angle = -2 * Math.PI * k / n;
    real[k] = Math.cos(angle);
    imag[k] = Math.sin(angle);
  }
  const twiddles = { real, imag };
  fftTwiddles.set(n, twiddles);
  return twiddles;
}

function getIFFTTwiddles(n) {
  if (ifftTwiddles.has(n)) return ifftTwiddles.get(n);
  const real = new Float32Array(n / 2);
  const imag = new Float32Array(n / 2);
  for (let k = 0; k < n / 2; k++) {
    const angle = 2 * Math.PI * k / n;
    real[k] = Math.cos(angle);
    imag[k] = Math.sin(angle);
  }
  const twiddles = { real, imag };
  ifftTwiddles.set(n, twiddles);
  return twiddles;
}

export function getHannWindow(size) {
  if (hannWindows.has(size)) return hannWindows.get(size);
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / size));
  }
  hannWindows.set(size, window);
  return window;
}

function bitReverse(n, bits) {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (n & 1);
    n >>= 1;
  }
  return result;
}

export function fft(realOut, imagOut, realIn, n) {
  const bits = Math.log2(n) | 0;
  const twiddles = getFFTTwiddles(n);

  for (let i = 0; i < n; i++) {
    const j = bitReverse(i, bits);
    realOut[i] = realIn[j];
    imagOut[i] = 0;
  }

  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const k = j * step;
        const tReal = twiddles.real[k];
        const tImag = twiddles.imag[k];
        const idx1 = i + j;
        const idx2 = i + j + halfSize;
        const eReal = realOut[idx1];
        const eImag = imagOut[idx1];
        const oReal = realOut[idx2] * tReal - imagOut[idx2] * tImag;
        const oImag = realOut[idx2] * tImag + imagOut[idx2] * tReal;
        realOut[idx1] = eReal + oReal;
        imagOut[idx1] = eImag + oImag;
        realOut[idx2] = eReal - oReal;
        imagOut[idx2] = eImag - oImag;
      }
    }
  }
}

export function ifft(realOut, imagOut, realIn, imagIn, n) {
  const bits = Math.log2(n) | 0;
  const twiddles = getIFFTTwiddles(n);

  for (let i = 0; i < n; i++) {
    const j = bitReverse(i, bits);
    realOut[i] = realIn[j];
    imagOut[i] = imagIn[j];
  }

  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const k = j * step;
        const tReal = twiddles.real[k];
        const tImag = twiddles.imag[k];
        const idx1 = i + j;
        const idx2 = i + j + halfSize;
        const eReal = realOut[idx1];
        const eImag = imagOut[idx1];
        const oReal = realOut[idx2] * tReal - imagOut[idx2] * tImag;
        const oImag = realOut[idx2] * tImag + imagOut[idx2] * tReal;
        realOut[idx1] = eReal + oReal;
        imagOut[idx1] = eImag + oImag;
        realOut[idx2] = eReal - oReal;
        imagOut[idx2] = eImag - oImag;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    realOut[i] /= n;
    imagOut[i] /= n;
  }
}

export function stft(signal, fftSize, hopSize) {
  const numFrames = Math.floor((signal.length - fftSize) / hopSize) + 1;
  const numBins = fftSize / 2 + 1;
  const window = getHannWindow(fftSize);
  const scale = 1.0 / Math.sqrt(fftSize);

  const specReal = new Float32Array(numFrames * numBins);
  const specImag = new Float32Array(numFrames * numBins);
  const frameReal = new Float32Array(fftSize);
  const frameImag = new Float32Array(fftSize);
  const windowedFrame = new Float32Array(fftSize);

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopSize;
    for (let i = 0; i < fftSize; i++) {
      windowedFrame[i] = signal[start + i] * window[i];
    }
    fft(frameReal, frameImag, windowedFrame, fftSize);
    const outOffset = frame * numBins;
    for (let k = 0; k < numBins; k++) {
      specReal[outOffset + k] = frameReal[k] * scale;
      specImag[outOffset + k] = frameImag[k] * scale;
    }
  }

  return { real: specReal, imag: specImag, numFrames, numBins };
}

export function istft(specReal, specImag, numFrames, numBins, fftSize, hopSize, length) {
  const outputLength = length || (numFrames - 1) * hopSize + fftSize;
  const output = new Float32Array(outputLength);
  const windowSum = new Float32Array(outputLength);
  const window = getHannWindow(fftSize);
  const scale = Math.sqrt(fftSize);

  const fullReal = new Float32Array(fftSize);
  const fullImag = new Float32Array(fftSize);
  const outReal = new Float32Array(fftSize);
  const outImag = new Float32Array(fftSize);

  for (let frame = 0; frame < numFrames; frame++) {
    fullReal.fill(0);
    fullImag.fill(0);

    for (let k = 0; k < numBins; k++) {
      fullReal[k] = specReal[frame * numBins + k];
      fullImag[k] = specImag[frame * numBins + k];
    }

    for (let k = 1; k < numBins - 1; k++) {
      fullReal[fftSize - k] = fullReal[k];
      fullImag[fftSize - k] = -fullImag[k];
    }

    ifft(outReal, outImag, fullReal, fullImag, fftSize);

    const start = frame * hopSize;
    for (let i = 0; i < fftSize && start + i < outputLength; i++) {
      output[start + i] += outReal[i] * window[i] * scale;
      windowSum[start + i] += window[i] * window[i];
    }
  }

  for (let i = 0; i < outputLength; i++) {
    if (windowSum[i] > 1e-8) {
      output[i] /= windowSum[i];
    }
  }

  return output;
}

export function reflectPad(signal, padLeft, padRight) {
  const length = signal.length;
  const output = new Float32Array(padLeft + length + padRight);

  for (let i = 0; i < padLeft; i++) {
    const srcIdx = Math.min(padLeft - i, length - 1);
    output[i] = signal[srcIdx];
  }

  output.set(signal, padLeft);

  for (let i = 0; i < padRight; i++) {
    const srcIdx = Math.max(0, length - 2 - i);
    output[padLeft + length + i] = signal[srcIdx];
  }

  return output;
}

/**
 * Demucs audio processor - Core separation logic
 */


const { SAMPLE_RATE, FFT_SIZE, HOP_SIZE, TRAINING_SAMPLES, MODEL_SPEC_BINS, MODEL_SPEC_FRAMES, SEGMENT_OVERLAP, TRACKS } = CONSTANTS;

/**
 * Convert model frequency output to complex spectrogram per track
 */
export function standaloneMask(freqOutput) {
  const numTracks = 4;
  const numChannels = 4;
  const numBins = MODEL_SPEC_BINS;
  const numFrames = MODEL_SPEC_FRAMES;
  const result = [];

  for (let t = 0; t < numTracks; t++) {
    const trackSpec = {
      leftReal: new Float32Array(numBins * numFrames),
      leftImag: new Float32Array(numBins * numFrames),
      rightReal: new Float32Array(numBins * numFrames),
      rightImag: new Float32Array(numBins * numFrames)
    };

    for (let f = 0; f < numFrames; f++) {
      for (let b = 0; b < numBins; b++) {
        const baseIdx = t * numChannels * numBins * numFrames;
        const outIdx = b * numFrames + f;
        trackSpec.leftReal[outIdx] = freqOutput[baseIdx + 0 * numBins * numFrames + b * numFrames + f];
        trackSpec.leftImag[outIdx] = freqOutput[baseIdx + 1 * numBins * numFrames + b * numFrames + f];
        trackSpec.rightReal[outIdx] = freqOutput[baseIdx + 2 * numBins * numFrames + b * numFrames + f];
        trackSpec.rightImag[outIdx] = freqOutput[baseIdx + 3 * numBins * numFrames + b * numFrames + f];
      }
    }
    result.push(trackSpec);
  }

  return result;
}

/**
 * Convert complex spectrogram back to time domain (iSTFT with proper offsets)
 */
export function standaloneIspec(trackSpec, targetLength) {
  const numBins = MODEL_SPEC_BINS;
  const numFrames = MODEL_SPEC_FRAMES;
  const hopLength = HOP_SIZE;
  const paddedBins = numBins + 1;
  const paddedFrames = numFrames + 4;

  const padChannel = (real, imag) => {
    const paddedReal = new Float32Array(paddedFrames * paddedBins);
    const paddedImag = new Float32Array(paddedFrames * paddedBins);

    for (let f = 0; f < numFrames; f++) {
      for (let b = 0; b < numBins; b++) {
        const srcIdx = b * numFrames + f;
        const dstFrame = f + 2;
        const dstIdx = dstFrame * paddedBins + b;
        paddedReal[dstIdx] = real[srcIdx];
        paddedImag[dstIdx] = imag[srcIdx];
      }
    }
    return { real: paddedReal, imag: paddedImag };
  };

  const leftPadded = padChannel(trackSpec.leftReal, trackSpec.leftImag);
  const rightPadded = padChannel(trackSpec.rightReal, trackSpec.rightImag);

  const centerPad = FFT_SIZE / 2;
  const pad = Math.floor(hopLength / 2) * 3;
  const istftLength = (paddedFrames - 1) * hopLength + FFT_SIZE;

  const leftOut = istft(leftPadded.real, leftPadded.imag, paddedFrames, paddedBins, FFT_SIZE, hopLength, istftLength);
  const rightOut = istft(rightPadded.real, rightPadded.imag, paddedFrames, paddedBins, FFT_SIZE, hopLength, istftLength);

  const totalOffset = centerPad + pad;
  const left = leftOut.subarray(totalOffset, totalOffset + targetLength);
  const right = rightOut.subarray(totalOffset, totalOffset + targetLength);

  return { left: new Float32Array(left), right: new Float32Array(right) };
}

/**
 * Prepare model input from stereo audio
 */
export function prepareModelInput(leftChannel, rightChannel) {
  const inputLength = TRAINING_SAMPLES;

  const paddedLeft = new Float32Array(inputLength);
  const paddedRight = new Float32Array(inputLength);
  const copyLen = Math.min(leftChannel.length, inputLength);
  paddedLeft.set(leftChannel.subarray(0, copyLen));
  paddedRight.set(rightChannel.subarray(0, copyLen));

  const le = Math.ceil(inputLength / HOP_SIZE);
  const pad = Math.floor(HOP_SIZE / 2) * 3;
  const padRight = pad + le * HOP_SIZE - inputLength;

  const stftInputLeft = reflectPad(paddedLeft, pad, padRight);
  const stftInputRight = reflectPad(paddedRight, pad, padRight);

  const centerPad = FFT_SIZE / 2;
  const centeredLeft = reflectPad(stftInputLeft, centerPad, centerPad);
  const centeredRight = reflectPad(stftInputRight, centerPad, centerPad);

  const stftLeft = stft(centeredLeft, FFT_SIZE, HOP_SIZE);
  const stftRight = stft(centeredRight, FFT_SIZE, HOP_SIZE);

  const numBins = MODEL_SPEC_BINS;
  const numFrames = MODEL_SPEC_FRAMES;
  const frameOffset = 2;

  const magSpec = new Float32Array(4 * numBins * numFrames);

  for (let f = 0; f < numFrames; f++) {
    const srcFrame = f + frameOffset;
    for (let b = 0; b < numBins; b++) {
      const srcIdx = srcFrame * stftLeft.numBins + b;
      magSpec[0 * numBins * numFrames + b * numFrames + f] = stftLeft.real[srcIdx];
      magSpec[1 * numBins * numFrames + b * numFrames + f] = stftLeft.imag[srcIdx];
      magSpec[2 * numBins * numFrames + b * numFrames + f] = stftRight.real[srcIdx];
      magSpec[3 * numBins * numFrames + b * numFrames + f] = stftRight.imag[srcIdx];
    }
  }

  const waveform = new Float32Array(2 * inputLength);
  waveform.set(paddedLeft, 0);
  waveform.set(paddedRight, inputLength);

  return { waveform, magSpec, numBins, numFrames, originalLength: leftChannel.length };
}


/* ===== Pocket Rack AI stem separation (progressive) =====
   Glue code above is from demucs-web (MIT, (c) 2024) which wraps Meta's HTDemucs.
   Everything below is Pocket Rack's own progressive scheduler. */
const ORT_VER='1.31.1';
const ORT_URL=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
export const MODEL_URL=CONSTANTS.DEFAULT_MODEL_URL;
export const L=TRAINING_SAMPLES, STRIDE=Math.floor(TRAINING_SAMPLES*(1-SEGMENT_OVERLAP)), SR=SAMPLE_RATE;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export async function loadOrt(){
  const ort=await import(ORT_URL+'ort.webgpu.min.mjs');
  ort.env.wasm.wasmPaths=ORT_URL;
  ort.env.wasm.numThreads=self.crossOriginIsolated?Math.min(4,navigator.hardwareConcurrency||2):1;
  return ort;
}

export async function fetchModel(onProgress){
  let cache=null;try{cache=await caches.open('pocket-rack-model-v1');}catch(e){}
  if(cache){const hit=await cache.match(MODEL_URL);if(hit){onProgress&&onProgress(1,true);return await hit.arrayBuffer();}}
  const res=await fetch(MODEL_URL);if(!res.ok)throw new Error('model download failed ('+res.status+')');
  const total=+res.headers.get('Content-Length')||172e6,rd=res.body.getReader(),parts=[];let got=0;
  for(;;){const {done,value}=await rd.read();if(done)break;parts.push(value);got+=value.length;onProgress&&onProgress(Math.min(got/total,.999),false);}
  const blob=new Blob(parts);
  if(cache){try{await cache.put(MODEL_URL,new Response(blob,{headers:{'Content-Type':'application/octet-stream'}}));}catch(e){}}
  onProgress&&onProgress(1,false);return await blob.arrayBuffer();
}

/* Real separator: returns async fn (left,right)=>[drums,bass,other,vocals] each {left,right} of length L */
export async function makeOnnxSeparator(ort,buf,onEP){
  const eps=(self.navigator&&navigator.gpu)?[['webgpu'],['wasm']]:[['wasm']];
  let session=null,used='';
  for(const ep of eps){try{session=await ort.InferenceSession.create(buf,{executionProviders:ep,graphOptimizationLevel:'basic'});used=ep[0];break;}catch(e){console.warn('EP failed',ep,e);}}
  if(!session)throw new Error('could not start the model in this browser');
  onEP&&onEP(used);
  return {ep:used,async run(left,right){
    const input=prepareModelInput(left,right);
    const feeds={};feeds[session.inputNames[0]]=new ort.Tensor('float32',input.waveform,[1,2,L]);
    if(session.inputNames.length>1)feeds[session.inputNames[1]]=new ort.Tensor('float32',input.magSpec,[1,4,MODEL_SPEC_BINS,MODEL_SPEC_FRAMES]);
    const res=await session.run(feeds);
    let td=null,ts=null,fd=null;
    for(const n of session.outputNames){const t=res[n];if(t.dims.length===4&&t.dims[2]===2){td=t.data;ts=t.dims;}else if(t.dims.length===5&&t.dims[2]===4)fd=t.data;}
    if(!td)throw new Error('unexpected model output');
    const S=ts[3],out=[];const specs=fd?standaloneMask(fd):null;
    for(let t=0;t<4;t++){
      const l=new Float32Array(S),r=new Float32Array(S);
      const fo=specs?standaloneIspec(specs[t],L):null;
      for(let i=0;i<S;i++){l[i]=td[t*2*S+i]+(fo?fo.left[i]||0:0);r[i]=td[t*2*S+S+i]+(fo?fo.right[i]||0:0);}
      out.push({left:l,right:r});
      if(t<3)await sleep(0);
    }
    return out;}};
}

/* Test double: no model. "drums" = whole signal, the rest silent, so the hot-swap path can be verified by ear/measurement. */
export function makeMockSeparator(delayMs=300){
  return {ep:'mock',async run(left,right){await sleep(delayMs);const z=()=>({left:new Float32Array(L),right:new Float32Array(L)});
    return [{left:left.slice(0,L),right:right.slice(0,L)},z(),z(),z()];}};
}

const win=(len)=>{const w=new Float32Array(len),h=STRIDE*.5;for(let i=0;i<len;i++)w[i]=Math.max(Math.min(i/h,(len-i)/h,1),.001);return w;};
const W=win(L);
const toI16=a=>{const o=new Int16Array(a.length);for(let i=0;i<a.length;i++){const v=a[i];o[i]=v>=1?32767:v<=-1?-32768:Math.round(v*32767);}return o;};

/* Progressive run. left/right: Float32Array at 44.1 kHz.
   playhead(): current position in samples. onChunk({start,end,d:[Int16Array x8]}) d index = stem*2+ch, stems in order drums,bass,other,vocals.
   isCancelled(): bool. onSeg({done,total,ms,secs}). Resolves when every segment is done. */
export async function runProgressive({left,right,sep,playhead,onChunk,onSeg,isCancelled}){
  const N=left.length,nSeg=Math.max(1,Math.ceil((N-L)/STRIDE)+1),done=new Uint8Array(nSeg);let nDone=0,prev=null;
  while(nDone<nSeg&&!isCancelled()){
    const want=Math.min(nSeg-1,Math.max(0,Math.floor(playhead()/STRIDE)));
    let i=-1;for(let k=want;k<nSeg;k++)if(!done[k]){i=k;break;}
    if(i<0)for(let k=0;k<want;k++)if(!done[k]){i=k;break;}
    const start=i*STRIDE,segLen=Math.min(L,N-start),t0=performance.now();
    const sl=new Float32Array(L),sr=new Float32Array(L);
    sl.set(left.subarray(start,start+segLen));sr.set(right.subarray(start,start+segLen));
    const out=await sep.run(sl,sr);
    if(isCancelled())return;
    // weighted accumulate
    const w=new Float32Array(segLen);for(let j=0;j<segLen;j++)w[j]=W[j];
    const acc=out.map(o=>({left:o.left.subarray(0,segLen).map((v,j)=>v*w[j]),right:o.right.subarray(0,segLen).map((v,j)=>v*w[j])}));
    const emitLen=(i===nSeg-1)?segLen:Math.min(STRIDE,segLen),d=[];
    const usePrev=prev&&prev.idx===i-1;
    for(let t=0;t<4;t++){
      const l=new Float32Array(emitLen),r=new Float32Array(emitLen);
      for(let j=0;j<emitLen;j++){
        let ws=w[j],a=acc[t].left[j],b=acc[t].right[j];
        if(usePrev){const pj=STRIDE+j;if(pj<prev.len){ws+=prev.w[pj];a+=prev.acc[t].left[pj];b+=prev.acc[t].right[pj];}}
        l[j]=a/ws;r[j]=b/ws;}
      d.push(toI16(l),toI16(r));
    }
    prev={idx:i,len:segLen,w,acc};done[i]=1;nDone++;
    onChunk({start,end:start+emitLen,d});
    onSeg&&onSeg({done:nDone,total:nSeg,ms:performance.now()-t0,secs:emitLen/SR});
    await sleep(0);
  }
}
