// Traditional Chinese (zh-TW). Must mirror en.js's key set exactly (enforced by
// i18n.test.js). Interpolation uses {var}; *_one / *_other are kept identical
// because Chinese has no singular/plural distinction.
export default {
  // ── Shared ──────────────────────────────────────────────────────────────
  "common.selectOne": "請選擇…",
  "common.optional": "（選填）",
  "common.language": "語言",

  // ── Wedding page ────────────────────────────────────────────────────────
  "wedding.docTitle": "{bride} & {groom} · 婚禮",
  "wedding.notFound.title": "找不到頁面",
  "wedding.notFound.body": "這個婚禮頁面不存在，或尚未設定。",
  "wedding.previewBanner": "預覽 — 此頁面尚未發佈，只有你能看到這個連結。",
  "wedding.inviteTag": "✦ {groom} & {bride} 誠摯邀請您 ✦",
  "wedding.inviteTagFallback": "— — — 誠摯邀請您 — — —",
  "wedding.rsvpNow": "立即回覆",
  "wedding.loading": "正在載入婚禮頁面",
  "wedding.rsvpHint": "使用邀請函中的專屬連結，體驗更快捷",

  "wedding.countdown.today": "就是今天！🎊",
  "wedding.countdown.toGo_one": "還有 {n} 天",
  "wedding.countdown.toGo_other": "還有 {n} 天",
  "wedding.countdown.ago_one": "已過 {n} 天",
  "wedding.countdown.ago_other": "已過 {n} 天",

  "wedding.story.eyebrow": "我們的故事",
  "wedding.story.title": "一切的開始",
  "wedding.funfacts.eyebrow": "趣味問答",
  "wedding.funfacts.title": "關於我們",
  "wedding.bigday.eyebrow": "大喜之日",
  "wedding.bigday.title": "活動詳情",
  "wedding.gettingthere.eyebrow": "交通指引",
  "wedding.gettingthere.title": "規劃您的行程",
  "wedding.join.eyebrow": "與我們同慶",
  "wedding.join.title": "期待與您相見！",

  "wedding.timeline.tea": "奉茶儀式",
  "wedding.timeline.solemnisation": "證婚儀式",
  "wedding.timeline.brunch": "早午宴",
  "wedding.timeline.lunch": "午宴",
  "wedding.timeline.dinner": "晚宴",
  "wedding.timeline.venue": "地點",

  "wedding.dressCodeLabel": "服裝要求：",
  "wedding.openMaps": "在 Google 地圖開啟 ↗",
  "wedding.rsvpBy": "請於 {date} 前回覆",
  "wedding.ctaWaiting": "{couple} 期待您的回覆 →",

  "wedding.funq.meet": "你們是怎麼認識的？",
  "wedding.funq.proposal": "求婚是怎麼發生的？",
  "wedding.funq.iloveyou": "誰先說「我愛你」？",
  "wedding.funq.cook": "誰比較會做飯？",
  "wedding.funq.funnier": "誰比較幽默？",
  "wedding.funq.fiercer": "誰比較兇？",
  "wedding.funq.memory": "你們最喜歡的共同回憶是什麼？",
  "wedding.funq.firstdate": "第一次約會發生了什麼？",

  // ── RSVP page ───────────────────────────────────────────────────────────
  "rsvp.docTitle": "婚禮回覆 · {bride} & {groom}",
  "rsvp.invited": "誠摯邀請您",
  "rsvp.eyebrow": "婚禮回覆",
  "rsvp.loading": "正在載入您的資料…",
  "rsvp.configError": "無法載入活動詳情，請嘗試重新整理。",
  "rsvp.demoBadge": "示範模式",

  "rsvp.name.label": "您的全名",
  "rsvp.name.placeholder": "請填寫邀請函上的名字",
  "rsvp.name.searchPlaceholder": "開始輸入您的名字…",
  "rsvp.name.clearAria": "清除名字選擇",
  "rsvp.searching": "搜尋中…",
  "rsvp.noMatch": "找不到相符的名字 — 請檢查拼寫或聯絡新人",

  "rsvp.email.label": "您的電子郵件",
  "rsvp.email.placeholder": "以便寄送確認信給您",

  "rsvp.attending.q": "您會出席嗎？",
  "rsvp.attending.yes": "✓ 會，我一定到！",
  "rsvp.attending.no": "✗ 抱歉，我無法出席",

  "rsvp.smart.title": "您會參加哪些活動？",
  "rsvp.smart.hint": "請為同行的每位賓客告訴我們。",
  "rsvp.smart.you": "您",

  "rsvp.rel.q": "您與新人是什麼關係？",
  "rsvp.friend.q": "是哪一類朋友？",
  "rsvp.closerTo": "與哪一方較熟",
  "rsvp.side.brideFallback": "新娘",
  "rsvp.side.groomFallback": "新郎",

  "rsvp.meal.label": "餐點選擇",
  "rsvp.dietary.label": "飲食需求",
  "rsvp.dietary.placeholder": "有任何過敏或飲食需求嗎？",

  "rsvp.speech.q": "您願意致詞嗎？",
  "rsvp.speech.yes": "🎤 好，我很樂意",
  "rsvp.speech.no": "不用了，謝謝",

  "rsvp.plus.q": "會帶其他賓客嗎？",
  "rsvp.plus.justMe": "只有我",
  "rsvp.plus.more_one": "另外 {n} 位賓客",
  "rsvp.plus.more_other": "另外 {n} 位賓客",
  "rsvp.plus.namePlaceholder": "第 {i} 位賓客全名",
  "rsvp.plus.disclaimer": "⚠️ 請通知新人此項增加。",

  "rsvp.notes.title": "給賓客的提醒",
  "rsvp.notes.parking": "🅿️ 停車：",
  "rsvp.notes.smoking": "🚭 吸菸：",

  "rsvp.message.label": "給新人的話",
  "rsvp.message.placeholder": "寫下祝福或想說的話…",

  "rsvp.submit": "確認回覆",
  "rsvp.submitting": "傳送中…",

  "rsvp.meal.Halal": "清真 (Halal)",
  "rsvp.meal.Vegetarian": "素食",
  "rsvp.meal.Normal": "一般",

  "rsvp.rel.family": "家人",
  "rsvp.rel.colleagues": "同事",
  "rsvp.rel.friends": "朋友",
  "rsvp.rel.other": "其他",
  "rsvp.rel.complicated": "一言難盡 😅",

  "rsvp.friend.army": "兵役 / NS",
  "rsvp.friend.primary_school": "小學",
  "rsvp.friend.secondary_school": "中學",
  "rsvp.friend.tertiary": "高中 / 專科",
  "rsvp.friend.university": "大學",
  "rsvp.friend.other": "其他",
  "rsvp.friend.secret": "😏 這是祕密",

  "rsvp.confirm.coupleFallback": "新人",
  "rsvp.confirm.eventTitleFallback": "婚禮",
  "rsvp.confirm.seeYou": "到時見！",
  "rsvp.confirm.miss": "我們會想念您！",
  "rsvp.confirm.yesMsg": "您的回覆已確認。{couple} 迫不及待想與您一同慶祝。",
  "rsvp.confirm.noMsg": "感謝您的告知。{couple} 會想念您。",
  "rsvp.confirm.addToCalendar": "加入行事曆",

  "rsvp.err.nameSelect": "請在上方輸入您的名字並從清單中選擇。",
  "rsvp.err.nameEnter": "請輸入您的名字。",
  "rsvp.err.attendingSelect": "請選擇您是否出席。",
  "rsvp.err.answerAllEvents": "請為每項活動選擇是否出席。",
  "rsvp.err.emailInvalid": "請輸入有效的電子郵件地址。",
  "rsvp.err.notSetup": "回覆功能尚未設定 — 資料庫尚未完成遷移，請聯絡新人。",
  "rsvp.err.linkExpired": "您的回覆連結已失效，請聯絡新人取得新連結。",
  "rsvp.err.generic": "發生錯誤，請再試一次或聯絡新人。",

  // Public runsheet page (#121)
  "runsheet.subtitle": "婚禮當日流程表",
  "runsheet.loading": "載入中…",
  "runsheet.notAvailable": "此流程表目前無法查看。",
  "runsheet.empty": "尚無流程項目",
  "runsheet.view.list": "列表",
  "runsheet.view.gantt": "時間軸",
  "runsheet.unscheduled": "未排定時間",
  "runsheet.ganttEmpty": "尚未排定任何時間。",
  "runsheet.durationMins": "{n} 分鐘",
};
