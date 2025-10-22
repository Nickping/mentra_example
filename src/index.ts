import { AppServer, AppSession, ViewType } from '@mentra/sdk';

const PACKAGE_NAME = process.env.PACKAGE_NAME ?? (() => { throw new Error('PACKAGE_NAME is not set in .env file'); })();
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY ?? (() => { throw new Error('MENTRAOS_API_KEY is not set in .env file'); })();
const PORT = parseInt(process.env.PORT || '3000');

/* -----------------------------
   간단 요약기(키워드 추출 기반)
------------------------------ */
const STOPWORDS_KO = new Set([
  "그리고","그래서","하지만","그러나","또","또한","이건","이것","그것","저것",
  "저는","나는","우리는","너는","여기는","거기는","저기는","오늘","내일","어제",
  "정말","진짜","너무","매우","아주","좀","조금","그냥","약간","및","등","등등",
  "에서","으로","까지","부터","에게","에게서","한테","하면서","하면서도","하며",
  "하다","했다","하는","하는데","됩니다","합니다","있다","있어요","없는","없다"
]);

const STOPWORDS_EN = new Set([
  "the","a","an","and","or","but","if","then","else","for","to","of","in","on","at",
  "is","are","was","were","be","been","being","i","you","he","she","it","we","they",
  "this","that","these","those","with","as","by","about","from","into","over","under",
  "very","really","just","so","too","also"
]);

function isKorean(str: string) {
  return /[\p{Script=Hangul}]/u.test(str);
}

function normalizeToken(t: string) {
  return t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "") // 유니코드 글자/숫자만 남김
    .trim();
}

function extractKeywords(text: string, topK = 6): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.split(/\s+/)) {
    const tok = normalizeToken(raw);
    if (!tok || tok.length < 2) continue;

    if (isKorean(tok)) {
      if (STOPWORDS_KO.has(tok)) continue;
    } else {
      if (STOPWORDS_EN.has(tok)) continue;
    }
    if (/^\d+$/.test(tok)) continue;

    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }

  // 빈도 + 길이 약간 가중
  const scored = [...counts.entries()]
    .map(([k, v]) => ({ k, score: v + Math.min(k.length, 10) * 0.2 }))
    .sort((a, b) => b.score - a.score || a.k.localeCompare(b.k));

  return scored.slice(0, topK).map(x => x.k);
}

/** 짧은 요약문 생성: 상위 키워드들을 자연스레 나열 */
function summarizeText(text: string): string {
  if (!text || text.trim().length === 0) return "요약할 내용이 없어요.";
  const kws = extractKeywords(text, 6);
  if (kws.length === 0) return text.length <= 40 ? text : text.slice(0, 40) + "…";

  // 한국어 문장 감지 시 '키워드 요약:' 형태, 아니면 'Summary:' 형태
  const prefix = isKorean(text) ? "키워드 요약" : "Summary";
  // HUD 가독성을 위해 쉼표 구분(최대 6개)
  return `${prefix}: ${kws.join(", ")}`;
}

class ExampleMentraOSApp extends AppServer {

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });
  }

  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    // 첫 메시지
    session.layouts.showTextWall("This is jason's first App. Now it's ready!", {
      view: ViewType.MAIN,
      durationMs: 2500,
    });

    // 실시간 음성 인식 처리
    // (개발자 콘솔에서 마이크 권한 필요)
    session.events.onTranscription((data) => {
      if (!data?.text) return;

      // 부분 인식 중에는 HUD를 자주 깜빡이지 않게 하고,
      // 최종 인식일 때에만 요약을 표시
      if (data.isFinal) {
        const summary = summarizeText(data.text);

        // HUD에 요약 정보 표시 (3초)
        session.layouts.showTextWall(summary, {
          view: ViewType.MAIN,
          durationMs: 3000
        });

        // 필요하면 원문도 잠깐 보이게 하려면 아래 라인을 유지/조절
        // session.layouts.showTextWall("You said: " + data.text, { view: ViewType.SECONDARY, durationMs: 2000 });
      }
    });

    session.events.onGlassesBattery((data) => {
      console.log('Glasses battery:', data);
    });
  }
}

// Start the server
const app = new ExampleMentraOSApp();
app.start().catch(console.error);