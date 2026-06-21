# bunjum2/religion 앱·웹 개발 슬라이드 내용 명세

이 문서는 디자인 파일이 아니라 **슬라이드에 반드시 들어가야 하는 내용 명세**다.  
디자인은 별도 제작자가 해도 되며, 아래 정보 구조와 실제 운영 사실을 유지하면 된다.

참조 디자인 원본 코드는 같은 폴더의 `D23_playful-3d_original.html`에 둔다.

---

## 0. 전체 의도

### 발표 제목

`AI가 웹과 앱 전체를 끝까지 개발·검증·배포하는 방법`

### 부제

`bunjum2/religion` 실제 운영 기록을 기준으로 본 기억엔진, 프론트엔진, AWS, Cloudflare, Android 검증 루프.

### 핵심 메시지

우리 시스템의 본질은 “예쁜 화면”이 아니라 **계약이 유지되는 전체 루프**다.

```text
원문 DB
  -> 기억엔진
  -> source-grounded-v2 결과 계약
  -> 웹/앱 프론트엔진
  -> AWS/Cloudflare 운영
  -> agent-browser/Waydroid 실제 사용자 경로 검증
```

화면 디자인, 엔진 내부, 배포 방식은 계속 바꿀 수 있다.  
하지만 아래는 깨면 안 된다:

- 원문 근거 보존
- 공개 API 경로와 job 상태 머신
- `source-grounded-v2` 결과 구조
- citation/source-window 검증 UX
- web/native 앱의 같은 기능 계약
- 실제 사용자 경로 검증
- 배포 후 public domain 기준 확인

---

## 1. 디자인 방향

### 원하는 톤

`D23 · playful-3d` 원본처럼 말랑하고 친근한 3D/claymorphism 톤을 참고한다.  
다만 이전 시안처럼 정보 대비가 낮으면 실패다. 이 덱은 교육/운영 문서이므로 **읽히는 것이 우선**이다.

### 참고할 시각 요소

- 크림/피치/버터/민트/하늘색 계열 배경
- 둥근 clay 카드
- 제품/엔진/도메인/검증을 말랑한 3D 오브젝트처럼 표현
- 파이프라인은 장난감 블록처럼 이어 붙이기
- 각 슬라이드에는 “하나의 중심 도식 + 상세 체크리스트”만 배치

### 피해야 할 것

- 텍스트가 희미한 pastel over-glow
- 큰 카드 안에 작은 카드가 너무 많이 들어가는 구조
- 개념 설명 없이 명령어만 나열
- AWS/Cloudflare를 일반론으로 설명하고 실제 우리 설정을 생략하는 것
- 내부명 `beta6`를 사용자-facing 제품명처럼 과하게 노출하는 것

---

## 2. 실제 제품/서비스 상태

이 덱은 `bunjum2/religion` 메모리와 코드에 남은 실제 구조를 기반으로 한다.

### 제품군

| 제품 키 | 이름/용도 | 포트 | 대표 라우트/상태 |
|---|---|---:|---|
| `islam` | Hikmah AI / 이슬람 근거 답변 | `8061` | gallery, bayyinah, merian, buylow skin |
| `tcm` | Hanui AI / 한의학 근거 답변 | `8062` | `tcm`, `tcm-chat`, gallery, merian |
| `simli` | PsyKey AI / 심리 문헌 근거 답변 | `8063` | `simli`, `simli-chat`; 운영 문서 수 `690,770` 기록 |
| `buddhist` | 불교 | `8064` | gallery, merian, buylow |
| `catholic` | 천주교/기독교 branch | `8065` | gallery, merian, buylow |
| `hindu` | 힌두교 | `8066` | gallery, merian, buylow |
| `lawkey` | 법률 근거 답변 | 별도 운영 | `lawkey.ai.kr` |

### 실제 운영 도메인

| 도메인 | 역할 |
|---|---|
| `https://lawkey.ai.kr` | Lawkey production domain. Lawkey APK stamp origin. |
| `https://psykey.ai.kr` | PsyKey production domain + shared religion products API proxy. |
| `http://sourpineapple.iptime.org:25565` | WSL stable shared origin. `psykey.ai.kr`/`lawkey.ai.kr`가 공유 제품 API proxy에 사용한 실제 origin 기록. |
| `trycloudflare.com` quick tunnel | 임시 미리보기/검증용. APK나 외부 전달용 origin으로 stamp하면 안 됨. |

---

## 3. 슬라이드 구성안

아래 순서대로 만들면 된다. 총 30장 전후가 적당하다.

---

### 1장. 제목

**핵심 문장**

> AI가 웹과 앱을 끝까지 만드는 법은 “코드 생성”이 아니라 “계약 유지 + 실제 사용자 경로 검증”이다.

**넣을 요소**

- `bunjum2/religion`
- `lawkey.ai.kr`
- `psykey.ai.kr`
- `source-grounded-v2`
- `agent-browser`
- `Waydroid`
- `AWS / Cloudflare`

**도식**

말랑한 3D 오브젝트 4개:

- DB Corpus
- Memory Engine
- Web/App Shell
- Proof Loop

---

### 2장. 우리가 만든 것은 무엇인가

**핵심 문장**

> 하나의 기억엔진/답변엔진/프론트엔진 계약으로 법률, 심리, 한의학, 종교 제품군을 돌린다.

**넣을 내용**

- Lawkey: 법률 근거 답변
- PsyKey: 심리 문헌 근거 답변
- Hikmah AI: 이슬람 근거 답변
- Hanui AI: 한의학 근거 답변
- Buddhist/Catholic/Hindu: 같은 플랫폼의 종교 코퍼스 제품

**시각화**

제품별 pill 카드. 각 카드에 “DB → API → Chat → Source Window” 작은 아이콘.

---

### 3장. 전체 시스템 한 장 지도

**핵심 문장**

> 질문 하나는 API job이 되고, job은 기억엔진을 거쳐 근거 카드와 답변으로 바뀌며, 프론트엔진은 그 계약만 렌더한다.

**정확한 파이프라인**

```text
Question
  -> POST /api/{product}/jobs
  -> durable job + progress
  -> memory engine
  -> selectedEvidence + claimCards + passageWindows
  -> writer
  -> source-grounded-v2 result
  -> web/native frontend
  -> citation/source-window proof
```

---

### 4장. 레이어와 교체 가능한 부품

**표**

| 레이어 | 현재 구현 | 바꿀 수 있는 것 | 절대 유지할 것 |
|---|---|---|---|
| DB/corpus | sqlite corpus DB | DB 내부 테이블/수집 방식 | 원문, source id, citation |
| Memory engine | `shared_platform/beta6.py` | 검색/선별 알고리즘 | `source-grounded-v2` 출력 |
| API/job server | `shared_platform/server.py`, `apps/*` | queue/worker/scale 구조 | endpoint path, job token, status |
| Frontend shell | `web/`, `native/` | 디자인/레이아웃/skin | job/progress/source-window hooks |
| Deploy | AWS EC2 + Cloudflare tunnel/domain | instance/proxy/deploy method | public health + browser proof |

---

### 5장. 기억엔진 철학

**핵심 문장**

> 요약은 색인일 뿐이고, 답변은 원문 근거에서만 나온다.

**반드시 넣을 원칙**

1. 원문 데이터는 항상 보존한다.
2. summary/embedding/graph는 replacement가 아니라 index다.
3. 모든 claim은 source id, citation, exact quote/span, context summary, source-window 좌표를 가진다.
4. 답변 엔진은 selected evidence와 claim card만 사용한다.
5. 성공은 내부 함수가 아니라 실제 사용자 경로로 판정한다.

---

### 6장. beta6 단계 구조

**단계**

```text
queued
starting
keyword_generation
candidate_search
source_selection
chunking
claim_cards
answer_plan
writer
coverage
completed
```

**넣을 설명**

- 긴 작업을 사용자가 볼 수 있는 progress stage로 나눈다.
- 프론트는 stage, percent, elapsedSeconds, message를 보여준다.
- stage가 움직여야 “멈춘 것처럼 보이는 앱”이 되지 않는다.

---

### 7장. durable job artifact

**핵심 문장**

> LLM/검색 작업은 오래 걸리고 실패할 수 있으므로 job마다 복구 가능한 파일 증거를 남긴다.

**넣을 파일**

```text
runs/<jobId>/
  request.json
  status.json
  selected_records.json
  selector_meta.json
  claim_cards.json
  candidate_claim_cards.json
  cited_claim_cards.json
  passage_windows.json
  answer_plan.json
  coverage_report.json
  result.json.pending
  result.json

runs/_beta6_queue/<jobId>.json
```

**설명**

- `result.json.pending`에서 최종 `result.json`으로 넘어가야 완료.
- queue row는 durable job admission과 외부 worker 처리를 위해 필요.

---

### 8장. API job 생성 규약

**반드시 들어갈 endpoint**

```http
POST /api/{product}/jobs
Content-Type: application/json
X-Beta6-Session-Token: <client-generated secret, 24+ chars>
X-Beta6-Account-Subject: <optional stable subject>

{
  "query": "사용자 질문",
  "language": "ko",
  "limit": 100
}
```

**설명**

- 응답에는 `jobId`와 create-only `accessToken`이 온다.
- 클라이언트는 sessionToken + accessToken을 local chat session과 같이 저장한다.
- 읽기/cancel/result/source-window 요청은 job ownership을 증명해야 한다.

---

### 9장. API 읽기/취소/source-window 규약

**넣을 endpoint**

```http
GET  /api/{product}/jobs/{jobId}
GET  /api/{product}/jobs/{jobId}/events
GET  /api/{product}/jobs/{jobId}/result
POST /api/{product}/jobs/{jobId}/cancel
GET  /api/{product}/source-window
```

**토큰 규칙**

```text
Authorization: Bearer <accessToken>
X-Beta6-Job-Token: <accessToken>
X-Beta6-Session-Token: <sessionToken>
X-Beta6-Account-Subject: <accountSubject if used>
```

**주의**

- pending 중 result는 HTTP 425일 수 있다.
- SSE가 터널 buffering에 죽지 않도록 initial padding/heartbeat가 필요하다.

---

### 10장. `source-grounded-v2` 결과 계약

**핵심 문장**

> 프론트가 믿고 그려도 되는 것은 공개 result field뿐이다.

**필드**

```text
answer / answerMarkdown
answerReadiness
selectedEvidence
claimCards
candidateClaimCards
citedClaimCards
passageWindows
answerPlan
coverageReport
citationMap
writer
selector
beta6 metadata
```

**금지**

- 프론트가 local run file, hidden prompt, internal logs를 긁어 UI를 만들면 안 된다.

---

### 11장. Claim Card의 의미

**핵심 문장**

> claim card는 기억엔진과 답변 writer와 source-window UI 사이의 접합부다.

**필드**

```json
{
  "claimId": "C1",
  "label": "S1",
  "sourceId": "...",
  "citation": "...",
  "claimAxis": "...",
  "stance": "support|limit|variant|gap|school_position",
  "contextSummary": "...",
  "claimSummary": "...",
  "quote": "exact quote",
  "span": {"start": 123, "end": 180},
  "quoteVerified": true
}
```

---

### 12장. Source Window UX

**핵심 문장**

> citation은 장식이 아니라 검증 버튼이다.

**동작**

- 답변의 `[S#]` 또는 `[C#]` 클릭
- `/api/{product}/source-window` 호출
- bounded source text 표시
- exact quote span highlight
- 필요 시 bounded radius 확장

**실패 조건**

- 원문 전체 dump
- quote highlight 없음
- `null`, `[META]`, `[PRIMARY TEXT]` 같은 내부 marker 노출
- 앱과 웹에서 source-window 동작이 다름

---

### 13장. 프론트엔진의 형태

**핵심 문장**

> 프론트엔진은 “예쁜 HTML”이 아니라 같은 job/source-window 계약을 수행하는 shell이다.

**구성**

```text
web/app-shell-manifest.json
web/*.html
web/*.css
web/chat-store.js
web/job-events.js
web/job-progress.js
web/job-cancel.js
web/ui-i18n.js
web/gallery-chat.js / merian-chat.js
native/android/.../app-shell-manifest.json
native/ios/Resources/app-shell-manifest.json
```

**설명**

- manifest가 web/native의 단일 진실원이다.
- route, product key, language, capabilities, native entry/chat route가 맞아야 한다.
- 디자인 파일은 바뀌어도 shared runtime hook은 유지한다.

---

### 14장. 앱 shell manifest

**현재 manifest에 있는 제품 capability**

```text
landing
chat
jobs
jobEvents
jobProgress
jobCancel
sourceWindow
citationSourceWindow
localChatStore
offlineOutbox
anonymousSessionToken
accountSubjectBinding
```

**설명**

- 어떤 디자인도 이 capability를 누락하면 안 된다.
- native copy는 `tools/sync_native_shell_assets.py`로 맞춘다.

---

### 15장. 디자인 교체 규약

**바꿔도 되는 것**

- layout
- color
- typography
- animation
- hero
- card shape
- product skin wrappers

**깨면 안 되는 것**

- API endpoint
- product key
- `data-product`
- input/send/progress/messages/source modal DOM hook
- session/access token 처리
- source-window/citation click path
- i18n catalog
- local chat persistence
- cancel/retry behavior

**예시**

`islam-buylow-chat.html`은 Merian DOM contract를 clone했고 `web/merian-chat.js`는 수정하지 않는 방식으로 구현되었다.

---

### 16장. 웹과 앱을 일치시키는 이념

**핵심 문장**

> 웹과 앱은 다른 코드가 아니라 같은 manifest와 같은 API 계약을 쓰는 두 shell이어야 한다.

**Thin WebView**

- 앱이 `https://lawkey.ai.kr` 또는 `https://psykey.ai.kr`를 직접 로드.
- 배포는 빠르지만 domain/tunnel이 죽으면 앱 첫 화면도 죽을 수 있다.

**Embedded Frontend**

- HTML/CSS/JS를 APK assets에 포함.
- 앱은 local shell을 띄우고 `/api/*`만 production domain으로 보냄.
- offline shell, cold start, store 안정성에 유리.

**우리의 실제 교훈**

quick tunnel URL로 stamp된 APK는 tunnel 만료 후 WebView가 initial HTML을 못 받아 실패했다.  
따라서 외부 배포 APK는 stable production domain 또는 embedded frontend를 써야 한다.

---

### 17장. 실제 도메인 구조

**표**

| 주소 | 역할 |
|---|---|
| `https://lawkey.ai.kr` | Lawkey production. APK stable origin. |
| `https://psykey.ai.kr` | PsyKey production + shared religion product API proxy. |
| `http://sourpineapple.iptime.org:25565` | WSL stable shared products origin. |
| `trycloudflare.com` | 임시 미리보기. 배포 stamp 금지. |

**그림**

```text
Browser / APK
  -> lawkey.ai.kr / psykey.ai.kr
  -> Cloudflare edge
  -> named tunnel / EC2 connector
  -> EC2 service or shared origin proxy
  -> memory engine / DB / writer
```

---

### 18장. Cloudflare 실제 설정

**메모리에 남은 실제값**

```text
Zone: psykey.ai.kr
DNS: psykey.ai.kr CNAME ee9900d1-e7fb-4ffc-9262-cb876927bbd4.cfargotunnel.com
proxied: true
Named tunnel: lawkey-prod
Tunnel connector origin IP: 43.200.191.87
```

**설명**

- 사용자는 `psykey.ai.kr`로 접속한다.
- Cloudflare는 DNS/proxy/tunnel 역할을 한다.
- origin이 살아있어도 Cloudflare cache/SW가 옛 파일을 줄 수 있으므로 headers와 purge를 확인한다.

---

### 19장. 새 도메인 네임서버 등록 절차

**절차**

1. Cloudflare에 site 추가.
2. Cloudflare가 제공하는 두 개의 nameserver 확인.
3. 도메인 등록기관에서 기존 nameserver를 Cloudflare nameserver로 교체.
4. Cloudflare DNS에 record 추가:
   - named tunnel이면 CNAME to `*.cfargotunnel.com`
   - 직접 EC2면 A record to EC2 public IP
5. proxied on/off 결정.
6. `curl https://domain/api/health`
7. 브라우저 실제 submit.
8. APK origin stamp는 이 stable domain으로만.

**주의**

- 네임서버 전파 전에는 되는 사람/안 되는 사람이 갈릴 수 있다.
- APK는 DNS가 안 되면 앱 문제처럼 보이므로 CDP로 `location.href`와 `chrome-error://`를 분리해 확인한다.

---

### 20장. AWS 실제 운영 구조

**메모리에 남은 운영 사실**

```text
AWS profile: buylow-codex
Instance name: lawkey-prod
Instance ID: i-0ad8fda1d5cf03152
Type: t3a.large
AZ: ap-northeast-2c
Public IP: 43.200.191.87
SSH: ubuntu@43.200.191.87
App root examples:
  /home/ubuntu/religion-dev/week1
  /home/ubuntu/religion-dev/simli-standalone
```

**우리 조작 방식**

- SSH로 remote checkpoint 생성.
- 변경 파일 업로드.
- remote `py_compile`.
- systemd env/drop-in 수정.
- service restart.
- local origin health 확인.
- public domain health 확인.
- browser submit/source-window 확인.

---

### 21장. AWS 비용/운영 주의

**실제 기록**

- 비용 약 130,000 KRW 이슈가 있었음.
- Cost Explorer MCP는 transport closed.
- local AWS CLI는 credentials/region이 없어 `NoCredentials`.
- remote EC2에는 AWS CLI가 없었음.
- 따라서 정확한 비용 breakdown은 확인 불가였다.

**말해야 할 점**

- 권한 없이 비용을 추측하면 안 된다.
- 확인된 live host facts:
  - `t3a.large`
  - root EBS 100GB
  - data directory 약 12GB
  - 상시 구동 EC2 + EBS + transfer + tax/FX로 비용 가능성 있음
- 실제 비용 자동화는 Cost Explorer 권한이 연결된 뒤에만 한다.

---

### 22장. AI로 AWS/Cloudflare를 자동화하는 법

**AI 루프**

```text
1. read memory/contracts
2. describe current infra
3. create checkpoint
4. apply minimal patch
5. restart service
6. verify local health
7. verify public health
8. verify browser user path
9. verify Android/WebView path if app affected
10. record rollback point
```

**AI가 하면 안 되는 말**

- “비용 원인은 이거다”라고 credentials 없이 단정.
- “배포됐다”라고 public domain 검증 없이 말하기.
- “앱이 고장났다”라고 DNS/WebView/cache를 분리하지 않고 말하기.

---

### 23장. 실제 장애 사례 1: PsyKey queue stuck

**증상**

- `https://psykey.ai.kr/`에서 채팅을 보내도 답이 안 옴.
- job status가 계속 `queued`.
- `/result`는 HTTP 425.

**원인**

- durable queue only API에서 worker가 없거나, worker 완료 status를 API runtime이 stale memory로 덮어봄.

**수정**

- external worker status refresh.
- embedded queue worker auto mode.
- queue-only API가 disk completion을 보도록 수정.

**검증**

- local browser submit.
- public browser submit.
- answer chars, citation chips, source-window highlight 확인.

---

### 24장. 실제 장애 사례 2: Cloudflare/SW cache

**증상**

- `psykey.ai.kr`가 새 UI가 아니라 예전 beta6 UI/서비스워커 흐름을 계속 보여줌.

**원인**

- Cloudflare가 예전 `sw.js`를 `cf-cache-status: HIT`로 반환.

**조치**

- Cloudflare purge:
  - `/`
  - `/index.html`
  - `/sw.js`
- SW reset URL 제거 확인.
- fresh browser에서 최종 URL이 `/`로 돌아오는지 확인.

---

### 25장. 실제 장애 사례 3: quick tunnel APK 실패

**증상**

- 이전 APK가 더 이상 열리지 않음.

**원인**

- APK가 `trycloudflare.com` quick tunnel origin으로 stamp되어 있었음.
- quick tunnel이 만료되자 WebView initial HTML fetch 실패.

**해결**

- `lawkey.ai.kr`, `psykey.ai.kr` production domain으로 APK rebuild/stamp.
- 이후 embedded frontend APK로 개선.

**슬라이드 핵심 문장**

> quick tunnel은 preview 도구이지 앱 배포 origin이 아니다.

---

### 26장. agent-browser 검증

**무엇을 검증하나**

- 페이지 로드
- 입력창 존재
- 질문 입력
- send 클릭
- progress stage 표시
- result 도착
- answer 길이
- citation/source count
- source-window 열림
- highlight text 존재

**예시 명령**

```bash
python3 tools/verify_browser_submit_path.py \
  --product simli \
  --base-url https://psykey.ai.kr \
  --query 'CBT가 불안에 도움이 된다는 근거와 한계를 알려줘' \
  --language ko \
  --timeout 600 \
  --min-answer-chars 1000 \
  --min-sources 20 \
  --min-cited-claims 1
```

**중요**

public Python result fetch가 Cloudflare 403을 맞아도 실제 browser UI path가 성공할 수 있다.  
그러므로 API-only 검증과 browser-user-path 검증을 분리한다.

---

### 27장. Waydroid/AVD 검증

**검증 항목**

- APK fresh install.
- MAIN/LAUNCHER intent.
- WebView URL 확인.
- keyboard/focus/input.
- submit.
- final answer.
- source-window.
- raw marker 노출 없음.
- phone viewport에서 composer가 잘림 없음.

**실제 교훈**

PsyKey WebView에서 `net::ERR_NAME_NOT_RESOLVED`가 났을 때:

- CDP는 URL이 `https://psykey.ai.kr/`임을 보여줌.
- 즉 APK origin stamp는 맞았다.
- 문제는 Waydroid DNS/routing이었다.

---

### 28장. 앱 빌드 규약

**Production-domain APK stamp 예시**

```bash
./gradlew ... \
  -PappLabel='PsyKey AI' \
  -PdefaultProduct=psykeyProduction \
  -PdefaultBaseOrigin=https://psykey.ai.kr \
  -PapplicationId=ai.bunjum.psykey.integrated \
  -PdefaultEntryRoute=/ \
  -PdefaultChatRoute=/
```

**검증**

- `aapt dump badging`
- `strings` over dex confirms:
  - `https://psykey.ai.kr`
  - product key
  - route
  - applicationId
- `apksigner verify`
- Waydroid/AVD runtime proof

---

### 29장. 제품 추가 절차

**새 product를 넣을 때 변경**

1. `shared_platform/products.py`
2. `apps/product_app.py`
3. `apps/<product>/server.py`
4. `web/<product>*.html`
5. `web/app-shell-manifest.json`
6. `native/android/app/src/main/assets/app-shell-manifest.json`
7. `native/ios/Resources/app-shell-manifest.json`
8. `web/sw.js` cache assets
9. tests

**검증**

```bash
python3 -m py_compile apps/product_app.py
python3 -m json.tool web/app-shell-manifest.json
node --check web/sw.js
python3 tools/sync_native_shell_assets.py --check
python3 tools/verify_app_parity.py --json
pytest tests/test_frontend_static.py tests/test_app_shell_parity.py -q
```

---

### 30장. 최종 원칙

**한 문장**

> 디자인은 바뀌고, 엔진도 바뀌지만, 원문 근거와 사용자 경로 검증 계약은 남는다.

**마지막 도식**

```text
Contracts stay.
Skins change.
Engines improve.
Proof decides.
```

---

## 4. 제작자가 반드시 확인해야 할 원본/근거 파일

### D23 디자인 원본

- `D23_playful-3d_original.html`
- 원본 위치:
  - `/home/pineapple/bunjum2/prayforfable_gen/D_round04/playful-3d.html`

### religion 구조 문서

- `/home/pineapple/bunjum2/religion/STRUCTURE_REQUIREMENTS.md`
- `/home/pineapple/bunjum2/religion/docs/overall-structure-requirements.md`
- `/home/pineapple/bunjum2/religion/docs/memory-engine-requirements.md`
- `/home/pineapple/bunjum2/religion/web/app-shell-manifest.json`
- `/home/pineapple/bunjum2/religion/apps/product_app.py`

### 실제 운영 메모리

- `/home/pineapple/bunjum2/religion/memory/2026-05-14.md`
  - PsyKey public deploy
  - Cloudflare zone/record/tunnel
  - EC2 `lawkey-prod`
  - queue stuck fix
  - service worker/cache issue
- `/home/pineapple/bunjum2/religion/memory/2026-05-27.md`
  - production-domain APK
  - quick tunnel APK failure
  - embedded frontend APK
  - Waydroid proof
- `/home/pineapple/bunjum2/religion/memory/2026-06-02.md`
  - stable domain shared products
  - `sourpineapple.iptime.org:25565`
  - AWS cost/domain incident
  - mobile layout proof
- `/home/pineapple/bunjum2/religion/memory/2026-06-03.md`
  - latest branch UI/app integration
  - AVD proof for Islam/Christian/TCM
- `/home/pineapple/bunjum2/religion/memory/2026-06-20.md`
  - buylow skin port for Islam and other religion products

---

## 5. 디자인 제작 시 품질 기준

### 내용 기준

- 실제값 없는 일반론 금지.
- “AWS는 서버다”가 아니라 “우리 EC2 `43.200.191.87`, systemd service, env, proxy origin”까지 설명.
- “Cloudflare는 DNS다”가 아니라 “우리 CNAME→cfargotunnel, named tunnel, cache purge, quick tunnel 실패”까지 설명.
- “앱을 만든다”가 아니라 “origin stamp, manifest sync, embedded frontend, Waydroid proof”까지 설명.

### 시각 기준

- 1장 1개 핵심 도식.
- 상세 항목은 3~5개 이하의 chunk로 나눈다.
- 색은 부드러워도 텍스트 대비는 강해야 한다.
- 코드는 길면 별도 박스에 넣고 줄바꿈을 강제한다.
- 모바일에서 카드/코드박스가 가로로 밀리면 실패.

### 최종 검증 기준

- 데스크톱 `1440x900`
- 모바일 `390x844`
- 콘솔 에러 0
- 가로 overflow 0
- 키보드 좌우 이동 가능
- 각 슬라이드 제목이 한눈에 읽힘
- `lawkey.ai.kr`, `psykey.ai.kr`, `43.200.191.87`, `sourpineapple.iptime.org:25565`, `source-grounded-v2`, `Waydroid`, `agent-browser`가 빠지지 않음

