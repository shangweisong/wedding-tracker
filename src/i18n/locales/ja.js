// Japanese (ja). Must mirror en.js's key set exactly (enforced by i18n.test.js).
// Interpolation uses {var}; *_one / *_other are kept identical because Japanese
// has no singular/plural distinction.
export default {
  // ── Shared ──────────────────────────────────────────────────────────────
  "common.selectOne": "選択してください…",
  "common.optional": "（任意）",
  "common.language": "言語",

  // ── Wedding page ────────────────────────────────────────────────────────
  "wedding.docTitle": "{bride} & {groom} · 結婚式",
  "wedding.notFound.title": "ページが見つかりません",
  "wedding.notFound.body": "この結婚式ページは存在しないか、まだ設定されていません。",
  "wedding.previewBanner": "プレビュー — このページはまだ公開されていません。このリンクはあなただけが見られます。",
  "wedding.inviteTag": "✦ {groom} & {bride} よりご招待します ✦",
  "wedding.inviteTagFallback": "— — — ご招待申し上げます — — —",
  "wedding.rsvpNow": "今すぐ出欠を登録",
  "wedding.loading": "結婚式ページを読み込んでいます",
  "wedding.rsvpHint": "招待状に記載の専用リンクからのご登録がおすすめです",

  "wedding.countdown.today": "本日です！🎊",
  "wedding.countdown.toGo_one": "あと {n} 日",
  "wedding.countdown.toGo_other": "あと {n} 日",
  "wedding.countdown.ago_one": "{n} 日前",
  "wedding.countdown.ago_other": "{n} 日前",

  "wedding.story.eyebrow": "私たちの物語",
  "wedding.story.title": "すべての始まり",
  "wedding.funfacts.eyebrow": "ちょっとした豆知識",
  "wedding.funfacts.title": "私たちについて",
  "wedding.bigday.eyebrow": "特別な日",
  "wedding.bigday.title": "イベント詳細",
  "wedding.gettingthere.eyebrow": "アクセス",
  "wedding.gettingthere.title": "会場までの行き方",
  "wedding.join.eyebrow": "ご参加ください",
  "wedding.join.title": "お会いできるのを楽しみにしています！",

  "wedding.timeline.tea": "お茶の儀式",
  "wedding.timeline.solemnisation": "結婚の儀",
  "wedding.timeline.brunch": "ブランチレセプション",
  "wedding.timeline.lunch": "ランチレセプション",
  "wedding.timeline.dinner": "ディナーレセプション",
  "wedding.timeline.venue": "会場",

  "wedding.dressCodeLabel": "ドレスコード：",
  "wedding.openMaps": "Google マップで開く ↗",
  "wedding.rsvpBy": "{date} までにご返信ください",
  "wedding.ctaWaiting": "{couple} があなたのご返信をお待ちしています →",

  "wedding.funq.meet": "お二人はどうやって出会ったのですか？",
  "wedding.funq.proposal": "プロポーズはどのように行われましたか？",
  "wedding.funq.iloveyou": "「愛してる」と先に言ったのはどちらですか？",
  "wedding.funq.cook": "料理が上手なのはどちらですか？",
  "wedding.funq.funnier": "面白いのはどちらですか？",
  "wedding.funq.fiercer": "怖いのはどちらですか？",
  "wedding.funq.memory": "お二人のお気に入りの思い出は何ですか？",
  "wedding.funq.firstdate": "初デートでは何がありましたか？",

  // ── RSVP page ───────────────────────────────────────────────────────────
  "rsvp.docTitle": "出欠登録 · {bride} & {groom} の結婚式",
  "rsvp.invited": "ご招待",
  "rsvp.eyebrow": "出欠登録",
  "rsvp.loading": "あなたの情報を読み込んでいます…",
  "rsvp.configError": "イベントの詳細を読み込めませんでした。再読み込みしてください。",
  "rsvp.demoBadge": "デモモード",

  "rsvp.name.label": "お名前（フルネーム）",
  "rsvp.name.placeholder": "招待状に記載のお名前",
  "rsvp.name.searchPlaceholder": "お名前を入力してください…",
  "rsvp.name.clearAria": "名前の選択をクリア",
  "rsvp.searching": "検索中…",
  "rsvp.noMatch": "一致する名前が見つかりません — スペルをご確認いただくか、新郎新婦にご連絡ください",

  // Open RSVP self-registration (#126)
  "rsvp.pin.label": "RSVP 暗証番号（PIN）",
  "rsvp.pin.placeholder": "招待状に記載のPIN",

  "rsvp.email.label": "メールアドレス",
  "rsvp.email.placeholder": "確認メールをお送りします",

  "rsvp.attending.q": "ご出席されますか？",
  "rsvp.attending.yes": "✓ はい、出席します！",
  "rsvp.attending.no": "✗ 申し訳ありませんが、欠席します",

  "rsvp.smart.title": "どの行事に参加されますか？",
  "rsvp.smart.hint": "ご一緒の方それぞれについてお知らせください。",
  "rsvp.smart.you": "あなた",


  "rsvp.rel.q": "新郎新婦とのご関係は？",
  "rsvp.friend.q": "どのようなご友人ですか？",
  "rsvp.closerTo": "どちらとより親しい",
  "rsvp.side.brideFallback": "新婦",
  "rsvp.side.groomFallback": "新郎",

  "rsvp.meal.label": "お食事の選択",
  "rsvp.dietary.label": "食事のご要望",
  "rsvp.dietary.placeholder": "アレルギーや食事のご要望はありますか？",

  "rsvp.speech.q": "スピーチをしていただけますか？",
  "rsvp.speech.yes": "🎤 はい、喜んで",
  "rsvp.speech.no": "いいえ、結構です",

  "rsvp.plus.q": "同伴のゲストはいらっしゃいますか？",
  "rsvp.plus.justMe": "自分だけ",
  "rsvp.plus.more_one": "あと {n} 名",
  "rsvp.plus.more_other": "あと {n} 名",
  "rsvp.plus.namePlaceholder": "{i} 人目のゲストのフルネーム",
  "rsvp.plus.disclaimer": "⚠️ この追加について新郎新婦にお知らせください。",

  "rsvp.notes.title": "ゲストへのご案内",
  "rsvp.notes.parking": "🅿️ 駐車場：",
  "rsvp.notes.smoking": "🚭 喫煙：",

  "rsvp.message.label": "新郎新婦へのメッセージ",
  "rsvp.message.placeholder": "メッセージやお祝いの言葉をどうぞ…",

  "rsvp.submit": "出欠を確定する",
  "rsvp.submitting": "送信中…",

  "rsvp.meal.Halal": "ハラル (Halal)",
  "rsvp.meal.Vegetarian": "ベジタリアン",
  "rsvp.meal.Normal": "通常",

  "rsvp.rel.family": "家族",
  "rsvp.rel.colleagues": "同僚",
  "rsvp.rel.friends": "友人",
  "rsvp.rel.other": "その他",
  "rsvp.rel.complicated": "複雑です 😅",

  "rsvp.friend.army": "兵役 / NS",
  "rsvp.friend.primary_school": "小学校",
  "rsvp.friend.secondary_school": "中学校",
  "rsvp.friend.tertiary": "高校・専門学校",
  "rsvp.friend.university": "大学",
  "rsvp.friend.other": "その他",
  "rsvp.friend.secret": "😏 秘密です",

  "rsvp.confirm.coupleFallback": "新郎新婦",
  "rsvp.confirm.eventTitleFallback": "結婚式",
  "rsvp.confirm.seeYou": "当日お会いしましょう！",
  "rsvp.confirm.miss": "お会いできず残念です！",
  "rsvp.confirm.yesMsg": "ご出欠を承りました。{couple} は一緒にお祝いできるのを楽しみにしています。",
  "rsvp.confirm.noMsg": "お知らせいただきありがとうございます。{couple} は残念に思っています。",
  "rsvp.confirm.addToCalendar": "カレンダーに追加",

  "rsvp.err.nameSelect": "上でお名前を入力し、リストから選択してください。",
  "rsvp.err.nameEnter": "お名前を入力してください。",
  "rsvp.err.attendingSelect": "ご出席かどうかを選択してください。",
  "rsvp.err.answerAllEvents": "各行事について出欠をお選びください。",
  "rsvp.err.emailInvalid": "有効なメールアドレスを入力してください。",
  "rsvp.err.pinRequired": "招待状に記載のPINを入力してください。",
  "rsvp.err.pinInvalid": "PINが一致しません — 招待状をご確認ください。",
  "rsvp.err.tooManyAttempts": "PINの入力回数が多すぎます — しばらくしてからもう一度お試しください。",
  "rsvp.err.notSetup": "出欠登録はまだ設定されていません — データベースの移行が実行されていません。新郎新婦にご連絡ください。",
  "rsvp.err.linkExpired": "出欠登録リンクの有効期限が切れました。新しいリンクについては新郎新婦にご連絡ください。",
  "rsvp.err.generic": "エラーが発生しました — もう一度お試しいただくか、新郎新婦にご連絡ください。",

  // Public runsheet page (#121)
  "runsheet.subtitle": "結婚式当日のスケジュール",
  "runsheet.loading": "読み込み中…",
  "runsheet.notAvailable": "このスケジュールは閲覧できません。",
  "runsheet.empty": "スケジュール項目はまだありません",
  "runsheet.view.list": "リスト",
  "runsheet.view.gantt": "タイムライン",
  "runsheet.unscheduled": "時間未定",
  "runsheet.ganttEmpty": "まだ時間が設定されていません。",
  "runsheet.durationMins": "{n}分",
};
