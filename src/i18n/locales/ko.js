// Korean (ko). Must mirror en.js's key set exactly (enforced by i18n.test.js).
// Interpolation uses {var}; *_one / *_other are kept identical because Korean
// has no singular/plural distinction.
export default {
  // ── Shared ──────────────────────────────────────────────────────────────
  "common.selectOne": "선택하세요…",
  "common.optional": "(선택 사항)",
  "common.language": "언어",

  // ── Wedding page ────────────────────────────────────────────────────────
  "wedding.docTitle": "{bride} & {groom} · 결혼식",
  "wedding.notFound.title": "페이지를 찾을 수 없습니다",
  "wedding.notFound.body": "이 결혼식 페이지가 존재하지 않거나 아직 설정되지 않았습니다.",
  "wedding.previewBanner": "미리보기 — 이 페이지는 아직 게시되지 않았습니다. 이 링크는 본인만 볼 수 있습니다.",
  "wedding.inviteTag": "✦ {groom} & {bride}가 당신을 초대합니다 ✦",
  "wedding.inviteTagFallback": "— — — 진심으로 초대합니다 — — —",
  "wedding.rsvpNow": "지금 참석 여부 알리기",
  "wedding.loading": "웨딩 페이지를 불러오는 중",
  "wedding.rsvpHint": "청첩장에 있는 개인 링크를 사용하시면 더 빠르게 이용하실 수 있습니다",

  "wedding.countdown.today": "바로 오늘입니다! 🎊",
  "wedding.countdown.toGo_one": "{n}일 남음",
  "wedding.countdown.toGo_other": "{n}일 남음",
  "wedding.countdown.ago_one": "{n}일 전",
  "wedding.countdown.ago_other": "{n}일 전",

  "wedding.story.eyebrow": "우리의 이야기",
  "wedding.story.title": "모든 것의 시작",
  "wedding.funfacts.eyebrow": "재미있는 사실",
  "wedding.funfacts.title": "우리에 대하여",
  "wedding.bigday.eyebrow": "특별한 날",
  "wedding.bigday.title": "행사 세부 정보",
  "wedding.gettingthere.eyebrow": "오시는 길",
  "wedding.gettingthere.title": "여정을 계획하세요",
  "wedding.join.eyebrow": "함께해 주세요",
  "wedding.join.title": "그곳에서 뵙기를 바랍니다!",

  "wedding.timeline.tea": "다도 예식",
  "wedding.timeline.solemnisation": "혼인 예식",
  "wedding.timeline.brunch": "브런치 연회",
  "wedding.timeline.lunch": "점심 연회",
  "wedding.timeline.dinner": "저녁 연회",
  "wedding.timeline.venue": "장소",

  "wedding.dressCodeLabel": "드레스 코드:",
  "wedding.openMaps": "Google 지도에서 열기 ↗",
  "wedding.rsvpBy": "{date}까지 회신해 주세요",
  "wedding.ctaWaiting": "{couple}가 당신의 회신을 기다리고 있습니다 →",

  "wedding.funq.meet": "두 분은 어떻게 만나셨나요?",
  "wedding.funq.proposal": "프러포즈는 어떻게 이루어졌나요?",
  "wedding.funq.iloveyou": "누가 먼저 '사랑해'라고 말했나요?",
  "wedding.funq.cook": "누가 요리를 더 잘하나요?",
  "wedding.funq.funnier": "누가 더 재미있나요?",
  "wedding.funq.fiercer": "누가 더 무섭나요?",
  "wedding.funq.memory": "두 분이 가장 좋아하는 추억은 무엇인가요?",
  "wedding.funq.firstdate": "첫 데이트에서 무슨 일이 있었나요?",

  // ── RSVP page ───────────────────────────────────────────────────────────
  "rsvp.docTitle": "참석 회신 · {bride} & {groom}의 결혼식",
  "rsvp.invited": "당신을 초대합니다",
  "rsvp.eyebrow": "참석 회신",
  "rsvp.loading": "정보를 불러오는 중…",
  "rsvp.configError": "행사 정보를 불러오지 못했습니다. 새로고침해 주세요.",
  "rsvp.demoBadge": "데모 모드",

  "rsvp.name.label": "성함 (전체 이름)",
  "rsvp.name.placeholder": "청첩장에 적힌 이름",
  "rsvp.name.searchPlaceholder": "이름을 입력하기 시작하세요…",
  "rsvp.name.clearAria": "이름 선택 지우기",
  "rsvp.searching": "검색 중…",
  "rsvp.noMatch": "일치하는 이름을 찾을 수 없습니다 — 철자를 확인하거나 신랑 신부에게 문의하세요",

  // Open RSVP self-registration (#126)
  "rsvp.pin.label": "RSVP PIN",
  "rsvp.pin.placeholder": "청첩장에 적힌 PIN",

  "rsvp.email.label": "이메일",
  "rsvp.email.placeholder": "확인 메일을 보내드립니다",

  "rsvp.attending.q": "참석하시겠습니까?",
  "rsvp.attending.yes": "✓ 네, 참석합니다!",
  "rsvp.attending.no": "✗ 죄송하지만 참석할 수 없습니다",

  "rsvp.smart.title": "어떤 행사에 참석하시나요?",
  "rsvp.smart.hint": "일행 각 분에 대해 알려주세요.",
  "rsvp.smart.you": "본인",


  "rsvp.rel.q": "신랑 신부와 어떤 사이신가요?",
  "rsvp.friend.q": "어떤 친구인가요?",
  "rsvp.closerTo": "누구와 더 가까운지",
  "rsvp.side.brideFallback": "신부",
  "rsvp.side.groomFallback": "신랑",

  "rsvp.meal.label": "식사 선택",
  "rsvp.dietary.label": "식이 요구 사항",
  "rsvp.dietary.placeholder": "알레르기나 식이 요구 사항이 있으신가요?",

  "rsvp.speech.q": "축사를 해 주시겠습니까?",
  "rsvp.speech.yes": "🎤 네, 기꺼이",
  "rsvp.speech.no": "아니요, 괜찮습니다",

  "rsvp.plus.q": "동반 하객이 있으신가요?",
  "rsvp.plus.justMe": "저만 참석",
  "rsvp.plus.more_one": "{n}명 추가",
  "rsvp.plus.more_other": "{n}명 추가",
  "rsvp.plus.namePlaceholder": "{i}번째 하객 성함",
  "rsvp.plus.disclaimer": "⚠️ 이 추가 사항을 신랑 신부에게 알려주세요.",

  "rsvp.notes.title": "하객 안내",
  "rsvp.notes.parking": "🅿️ 주차:",
  "rsvp.notes.smoking": "🚭 흡연:",

  "rsvp.message.label": "신랑 신부에게 전하는 말",
  "rsvp.message.placeholder": "메시지나 축하의 말을 남겨주세요…",

  "rsvp.submit": "참석 회신 확정",
  "rsvp.submitting": "전송 중…",

  "rsvp.meal.Halal": "할랄 (Halal)",
  "rsvp.meal.Vegetarian": "채식",
  "rsvp.meal.Normal": "일반",

  "rsvp.rel.family": "가족",
  "rsvp.rel.colleagues": "동료",
  "rsvp.rel.friends": "친구",
  "rsvp.rel.other": "기타",
  "rsvp.rel.complicated": "복잡해요 😅",

  "rsvp.friend.army": "군대 / 병역",
  "rsvp.friend.primary_school": "초등학교",
  "rsvp.friend.secondary_school": "중학교",
  "rsvp.friend.tertiary": "고등학교 / 전문대",
  "rsvp.friend.university": "대학교",
  "rsvp.friend.other": "기타",
  "rsvp.friend.secret": "😏 비밀이에요",

  "rsvp.confirm.coupleFallback": "신랑 신부",
  "rsvp.confirm.eventTitleFallback": "결혼식",
  "rsvp.confirm.seeYou": "그곳에서 뵙겠습니다!",
  "rsvp.confirm.miss": "보고 싶을 거예요!",
  "rsvp.confirm.yesMsg": "참석 회신이 확정되었습니다. {couple}가 함께 축하할 날을 손꼽아 기다립니다.",
  "rsvp.confirm.noMsg": "알려주셔서 감사합니다. {couple}가 아쉬워할 거예요.",
  "rsvp.confirm.addToCalendar": "캘린더에 추가",

  "rsvp.err.nameSelect": "위에 성함을 입력하고 목록에서 선택해 주세요.",
  "rsvp.err.nameEnter": "성함을 입력해 주세요.",
  "rsvp.err.attendingSelect": "참석 여부를 선택해 주세요.",
  "rsvp.err.answerAllEvents": "각 행사에 대해 참석 여부를 선택해 주세요.",
  "rsvp.err.emailInvalid": "유효한 이메일 주소를 입력해 주세요.",
  "rsvp.err.pinRequired": "청첩장에 적힌 RSVP PIN을 입력해 주세요.",
  "rsvp.err.pinInvalid": "PIN이 일치하지 않습니다 — 청첩장을 확인해 주세요.",
  "rsvp.err.tooManyAttempts": "PIN 시도 횟수가 너무 많습니다 — 잠시 후 다시 시도해 주세요.",
  "rsvp.err.notSetup": "참석 회신이 아직 설정되지 않았습니다 — 데이터베이스 마이그레이션이 실행되지 않았습니다. 신랑 신부에게 문의하세요.",
  "rsvp.err.linkExpired": "참석 회신 링크가 만료되었습니다. 새 링크는 신랑 신부에게 문의하세요.",
  "rsvp.err.generic": "오류가 발생했습니다 — 다시 시도하거나 신랑 신부에게 문의하세요.",

  // Public runsheet page (#121)
  "runsheet.subtitle": "결혼식 당일 일정표",
  "runsheet.loading": "불러오는 중…",
  "runsheet.notAvailable": "이 일정표는 볼 수 없습니다.",
  "runsheet.empty": "아직 일정 항목이 없습니다",
  "runsheet.view.list": "목록",
  "runsheet.view.gantt": "타임라인",
  "runsheet.unscheduled": "시간 미정",
  "runsheet.ganttEmpty": "아직 예정된 항목이 없습니다.",
  "runsheet.durationMins": "{n}분",
};
