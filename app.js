// ===== 状態管理 =====
const state = {
  apiKey: "",
  currentLevel: "toeic300",
  currentIndex: 0,
  phrases: [],
};

// ===== DOM取得 =====
const apiModal      = document.getElementById("api-modal");
const apiKeyInput   = document.getElementById("api-key-input");
const apiSaveBtn    = document.getElementById("api-save-btn");
const apiChangeBtn  = document.getElementById("api-change-btn");
const levelSelect   = document.getElementById("level-select");
const progressText  = document.getElementById("progress-text");
const progressPct   = document.getElementById("progress-percent");
const progressFill  = document.getElementById("progress-fill");
const businessText  = document.getElementById("business-text");
const inputD        = document.getElementById("input-d");
const inputE        = document.getElementById("input-e");
const submitBtn     = document.getElementById("submit-btn");
const resultSection = document.getElementById("result-section");
const resultLoading = document.getElementById("result-loading");
const resultContent = document.getElementById("result-content");
const modelD        = document.getElementById("model-d");
const modelC        = document.getElementById("model-c");
const feedbackText  = document.getElementById("feedback-text");
const speakBtnD     = document.getElementById("speak-d");
const speakBtnC     = document.getElementById("speak-c");
const retryBtn      = document.getElementById("retry-btn");
const nextBtn       = document.getElementById("next-btn");
const prevBtn       = document.getElementById("prev-btn");
const nextMiniBtn   = document.getElementById("next-mini-btn");
const step1Guide    = document.getElementById("step1-guide");
const step2Guide    = document.getElementById("step2-guide");
const inputGroupD   = document.getElementById("input-group-d");
const inputGroupE   = document.getElementById("input-group-e");

// ===== 初期化 =====
function init() {
  const savedKey = localStorage.getItem("gemini_api_key");
  if (savedKey) {
    state.apiKey = savedKey;
    apiModal.classList.add("hidden");
  }
  loadLevel(state.currentLevel);
  renderQuestion();
}

// ===== レベルデータ読み込み =====
function loadLevel(levelKey) {
  state.phrases = LEVELS[levelKey].phrases;
  state.currentIndex = 0;
}

// ===== 問題を表示 =====
function renderQuestion() {
  const total = state.phrases.length;
  const idx   = state.currentIndex;

  businessText.textContent = state.phrases[idx];

  const pct = Math.round((idx / total) * 100);
  progressText.textContent  = `${idx + 1} / ${total}`;
  progressPct.textContent   = `${pct}%`;
  progressFill.style.width  = `${pct}%`;

  // 入力リセット
  inputD.value = "";
  inputE.value = "";
  submitBtn.disabled = true;

  // 結果エリアを隠す
  resultSection.style.display = "none";
  resultContent.style.display = "none";
  resultLoading.style.display = "flex";

  // ステップ状態リセット
  step1Guide.classList.add("active");
  step2Guide.classList.remove("active");
  inputGroupD.classList.remove("highlight");
  inputGroupE.classList.remove("highlight");
}

// ===== 入力監視 =====
inputD.addEventListener("input", () => {
  if (inputD.value.trim()) {
    step1Guide.classList.remove("active");
    step2Guide.classList.add("active");
    inputGroupE.classList.add("highlight");
  } else {
    step1Guide.classList.add("active");
    step2Guide.classList.remove("active");
    inputGroupE.classList.remove("highlight");
  }
  updateSubmitBtn();
});

inputE.addEventListener("input", updateSubmitBtn);

function updateSubmitBtn() {
  submitBtn.disabled = !(inputD.value.trim() && inputE.value.trim());
}

// ===== 添削ボタン =====
submitBtn.addEventListener("click", async () => {
  if (!state.apiKey) {
    apiModal.classList.remove("hidden");
    return;
  }

  const textC = state.phrases[state.currentIndex];
  const textD = inputD.value.trim();
  const textE = inputE.value.trim();

  resultSection.style.display = "block";
  resultLoading.style.display = "flex";
  resultContent.style.display = "none";
  submitBtn.disabled = true;

  try {
    const result = await callGemini(textC, textD, textE);
    modelD.textContent       = result.model_d;
    modelC.textContent       = result.model_c;
    feedbackText.textContent = result.feedback;

    resultLoading.style.display = "none";
    resultContent.style.display = "flex";

    // 音声を裏で先読み生成（ボタンを押した瞬間に再生できるよう）
    prefetchTts(result.model_d, result.model_c);
  } catch (err) {
    resultLoading.style.display = "none";
    resultContent.style.display = "flex";
    modelD.textContent       = "エラーが発生しました";
    modelC.textContent       = "";
    feedbackText.textContent = "❌ " + err.message;
  }
});

// ===== Gemini API呼び出し =====
async function callGemini(textC, textD, textE) {
  const prompt =
    `あなたは経験豊富なプロの英語教師です。以下のデータをもとにJSON形式で回答してください。\n` +
    `【データ】\n` +
    `・元の日本語: "${textC}"\n` +
    `・生徒が考えた5歳児レベルの日本語: "${textD}"\n` +
    `・生徒の英訳: "${textE}"\n\n` +
    `【feedbackの書き方（必ず以下の5つの観点をすべて含めること）】\n` +
    `1. 【良かった点】生徒の英訳で正しかった・自然だった表現を具体的に褒める\n` +
    `2. 【文法チェック】文法的な誤りや不自然な点を指摘し、なぜ間違いなのかを日本語でわかりやすく説明する\n` +
    `3. 【より自然な表現】生徒の訳をベースに、ネイティブがより自然に使う言い回しを提案し、その理由も添える\n` +
    `4. 【語彙・表現の豆知識】使われた単語や表現に関連する豆知識、似た表現との違い、使い分けのコツを紹介する\n` +
    `5. 【次のステップ】この表現をさらに発展させるための一言アドバイスや、関連して覚えておくと便利なフレーズを提示する\n\n` +
    `【出力形式（厳密なJSON形式のみを出力。装飾不要）】\n` +
    `{\n` +
    `  "model_c": "元の日本語に対する最適な英語（自然でこなれた表現）",\n` +
    `  "model_d": "5歳児レベルの日本語に対するシンプルで自然な英語",\n` +
    `  "feedback": "上記5つの観点をすべて含む、詳しく丁寧な日本語フィードバック（各観点は改行で区切る）"\n` +
    `}`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${state.apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (json.error) {
    throw new Error(json.error.message);
  }

  let raw = json.candidates[0].content.parts[0].text;
  raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(raw);
}

// ===== 読み上げ（Gemini TTS APIでネイティブクオリティ） =====
// Gemini 2.5 Flash Preview TTS を使って自然な女性ボイスを生成
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_VOICE = "Kore"; // Gemini TTS 女性ボイス（ナチュラル）

let currentAudio = null;
// テキスト → 生成済みオブジェクトURL or 生成中のPromise のキャッシュ
const ttsCache = new Map();

function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  document.querySelectorAll(".speak-btn").forEach(b => {
    b.classList.remove("speaking");
    b.dataset.speaking = "0";
  });
}

// テキストから音声URLを取得（キャッシュ利用）
function getTtsUrl(text) {
  if (!text) return null;
  if (ttsCache.has(text)) return ttsCache.get(text);

  const promise = (async () => {
    const audioBase64 = await callGeminiTTS(text);
    const wavBlob = pcmBase64ToWavBlob(audioBase64);
    return URL.createObjectURL(wavBlob);
  })();

  ttsCache.set(text, promise);
  return promise;
}

// 結果が返ってきたタイミングで呼ぶ：裏で先読み生成
function prefetchTts(...texts) {
  if (!state.apiKey) return;
  texts.forEach(t => {
    if (t && !ttsCache.has(t)) {
      getTtsUrl(t).catch(() => ttsCache.delete(t));
    }
  });
}

async function speak(text, btn) {
  if (!text) return;

  // 同じボタンを再度押したら停止
  if (btn.dataset.speaking === "1") {
    stopSpeaking();
    return;
  }

  stopSpeaking();

  btn.classList.add("speaking");
  btn.dataset.speaking = "1";

  try {
    if (!state.apiKey) throw new Error("APIキーが未設定です");

    const objectUrl = await getTtsUrl(text);

    currentAudio = new Audio(objectUrl);
    currentAudio.playbackRate = 1.05;

    currentAudio.onended = () => {
      btn.classList.remove("speaking");
      btn.dataset.speaking = "0";
      currentAudio = null;
    };
    currentAudio.onerror = () => {
      btn.classList.remove("speaking");
      btn.dataset.speaking = "0";
      currentAudio = null;
      fallbackSpeak(text, btn);
    };

    await currentAudio.play();
  } catch (err) {
    console.warn("Gemini TTS failed, falling back:", err);
    ttsCache.delete(text);
    btn.classList.remove("speaking");
    btn.dataset.speaking = "0";
    fallbackSpeak(text, btn);
  }
}

async function callGeminiTTS(text) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${state.apiKey}`;

  const body = {
    contents: [{ parts: [{ text: text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: TTS_VOICE }
        }
      }
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.candidates[0].content.parts[0].inlineData.data;
}

// Gemini TTS は 24kHz 16bit mono PCM を返す → WAV ヘッダを付けて再生可能にする
function pcmBase64ToWavBlob(base64) {
  const binary = atob(base64);
  const pcmBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) pcmBytes[i] = binary.charCodeAt(i);

  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBytes.length;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const wav = new Uint8Array(44 + dataSize);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcmBytes, 44);
  return new Blob([wav], { type: "audio/wav" });
}

function fallbackSpeak(text, btn) {
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 1.0;
  btn.classList.add("speaking");
  btn.dataset.speaking = "1";
  utter.onend = () => {
    btn.classList.remove("speaking");
    btn.dataset.speaking = "0";
  };
  window.speechSynthesis.speak(utter);
}

speakBtnD.addEventListener("click", () => speak(modelD.textContent, speakBtnD));
speakBtnC.addEventListener("click", () => speak(modelC.textContent, speakBtnC));

// ===== やり直しボタン =====
retryBtn.addEventListener("click", () => {
  renderQuestion();
});

// ===== 次の問題（結果後） =====
nextBtn.addEventListener("click", goNext);

// ===== ナビゲーション =====
nextMiniBtn.addEventListener("click", goNext);
prevBtn.addEventListener("click", () => {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    renderQuestion();
  }
});

function goNext() {
  if (state.currentIndex < state.phrases.length - 1) {
    state.currentIndex++;
    renderQuestion();
  } else {
    alert("🎉 全問完了！お疲れさまでした！");
  }
}

// ===== APIキー保存 =====
apiSaveBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    alert("APIキーを入力してください。");
    return;
  }
  state.apiKey = key;
  localStorage.setItem("gemini_api_key", key);
  apiModal.classList.add("hidden");
});

apiChangeBtn.addEventListener("click", () => {
  apiKeyInput.value = state.apiKey;
  apiModal.classList.remove("hidden");
});

// ===== レベル切り替え =====
levelSelect.addEventListener("change", () => {
  state.currentLevel = levelSelect.value;
  loadLevel(state.currentLevel);
  renderQuestion();
});

// ===== 起動 =====
init();
