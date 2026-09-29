import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { onValue, push, ref, update } from 'firebase/database'
import {
  ArrowDownUp, BadgeEuro, Box, BusFront, Check, ChevronDown, CircleAlert,
  Clock3, LogOut, MessageSquareText, PackagePlus, Pause, Plane, Plus, Search, ShieldCheck,
  Star, Trash2, Truck, X,
} from 'lucide-react'
import { auth, database } from './lib/firebase'
import { getCurrentStatusIndex, getDeliveryDays, shipmentStatuses, type AdminReview, type Shipment, type ShippingMethod } from './lib/shipping'
import './AdminApp.css'

type ReviewDraft = Pick<AdminReview, 'author' | 'rating' | 'text' | 'isPublished'>
const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || 'smixnevertime@gmail.com,mmabou287@gmail.com')
  .split(',')
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean)
const adminNickname = 'ADMINCRG'
const demoPassword = 'CRGADM321'
const demoShipmentsKey = 'cargo7-demo-shipments'
const demoReviewsKey = 'cargo7-demo-reviews'
const pageOpenedAt = Date.now()
const currentTimestamp = () => Date.now()

function readDemoData<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

function writeDemoData<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data))
}

function makeTrackingCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `CN7-${suffix}`
}

function getPublicShipment(shipment: Shipment) {
  return {
    statusIndex: shipment.statusIndex,
    statusStartedAt: shipment.statusStartedAt,
    createdAt: shipment.createdAt,
    deliveryDays: shipment.deliveryDays,
    shippingMethod: shipment.shippingMethod,
    isPaused: shipment.isPaused,
    ...(shipment.pausedAt ? { pausedAt: shipment.pausedAt } : {}),
    pausedMs: shipment.pausedMs,
    isStopped: shipment.isStopped,
    ...(shipment.stoppedAt ? { stoppedAt: shipment.stoppedAt } : {}),
    ...(shipment.surcharge ? { surcharge: shipment.surcharge } : {}),
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [authReady, setAuthReady] = useState(!auth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [activeView, setActiveView] = useState<'shipments' | 'reviews'>('shipments')
  const [selectedCode, setSelectedCode] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>({ author: '', rating: 5, text: '', isPublished: true })
  const [editingReviewId, setEditingReviewId] = useState('')
  const [now, setNow] = useState(pageOpenedAt)
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [newShipment, setNewShipment] = useState({ customerNickname: '', weightKg: '', paidAmount: '', shippingMethod: 'air' as ShippingMethod, statusIndex: 0 })
  const [surchargeAmount, setSurchargeAmount] = useState('')
  const [surchargeMessage, setSurchargeMessage] = useState('')

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); setAuthReady(true) })
  }, [])

  useEffect(() => {
    if (!user || !database) return
    const stopShipments = onValue(ref(database, 'shipments'), (snapshot) => {
      const records = snapshot.val() as Record<string, Omit<Shipment, 'code'>> | null
      setShipments(Object.entries(records ?? {}).map(([code, record]) => ({ code, ...record })).sort((a, b) => b.createdAt - a.createdAt))
    })
    const stopReviews = onValue(ref(database, 'reviews'), (snapshot) => {
      const records = snapshot.val() as Record<string, Omit<AdminReview, 'id'>> | null
      setReviews(Object.entries(records ?? {}).map(([id, review]) => ({ id, ...review })).sort((a, b) => b.createdAt - a.createdAt))
    })
    return () => { stopShipments(); stopReviews() }
  }, [user])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const selectedShipment = shipments.find((shipment) => shipment.code === selectedCode) ?? null
  const filteredShipments = useMemo(() => shipments.filter((shipment) => `${shipment.code} ${shipment.customerNickname}`.toLowerCase().includes(searchTerm.toLowerCase())), [shipments, searchTerm])
  const activeCount = shipments.filter((shipment) => !shipment.isStopped && getCurrentStatusIndex(shipment, now) < shipmentStatuses.length - 1).length
  const readyCount = shipments.filter((shipment) => getCurrentStatusIndex(shipment, now) === shipmentStatuses.length - 1).length
  const pausedCount = shipments.filter((shipment) => shipment.isPaused).length

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginError('')
    const loginValue = username.trim()
    const targetEmail = loginValue.toUpperCase() === adminNickname ? adminEmails[0] : loginValue.toLowerCase()
    if (!adminEmails.includes(targetEmail)) {
      setLoginError('Неверный ник или пароль.')
      return
    }
    if (!auth || !database) {
      if (password !== demoPassword) {
        setLoginError('Неверный ник или пароль.')
        return
      }
      setDemoMode(true)
      setShipments(readDemoData<Shipment>(demoShipmentsKey))
      setReviews(readDemoData<AdminReview>(demoReviewsKey))
      return
    }
    try {
      const credential = await signInWithEmailAndPassword(auth, targetEmail, password)
      if (!adminEmails.includes(credential.user.email?.toLowerCase() ?? '')) {
        await signOut(auth)
        setLoginError('Email этого аккаунта не разрешён для админки.')
        return
      }
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user)
        await signOut(auth)
        setLoginError('Отправил письмо для подтверждения email. Подтвердите его и войдите ещё раз.')
      }
    } catch {
      setLoginError('Неверный ник или пароль.')
    }
  }

  async function createShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!database && !demoMode) return
    const nickname = newShipment.customerNickname.trim()
    const weightKg = Number(newShipment.weightKg)
    const paidAmount = Number(newShipment.paidAmount)
    if (!nickname || !Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(paidAmount) || paidAmount < 0) {
      setFormError('Заполните ник, вес больше нуля и корректную оплаченную сумму.')
      return
    }
    const code = makeTrackingCode()
    const timestamp = currentTimestamp()
    const record: Shipment = {
      code, customerNickname: nickname, weightKg, paidAmount,
      shippingMethod: newShipment.shippingMethod,
      deliveryDays: getDeliveryDays(newShipment.shippingMethod),
      statusIndex: newShipment.statusIndex,
      statusStartedAt: timestamp, createdAt: timestamp,
      isPaused: false, pausedMs: 0, isStopped: false,
      statusHistory: [{ statusIndex: newShipment.statusIndex, at: timestamp }],
    }
    if (!database) {
      const nextShipments = [record, ...shipments]
      writeDemoData(demoShipmentsKey, nextShipments)
      setShipments(nextShipments)
      setCreateOpen(false)
      setSelectedCode(code)
      setNewShipment({ customerNickname: '', weightKg: '', paidAmount: '', shippingMethod: 'air', statusIndex: 0 })
      showNotice(`Создан демо-трек-код ${code}`)
      return
    }
    try {
      await update(ref(database), { [`shipments/${code}`]: record, [`publicTracking/${code}`]: getPublicShipment(record) })
      setCreateOpen(false)
      setSelectedCode(code)
      setNewShipment({ customerNickname: '', weightKg: '', paidAmount: '', shippingMethod: 'air', statusIndex: 0 })
      showNotice(`Создан трек-код ${code}`)
    } catch {
      setFormError('Не удалось сохранить посылку. Проверьте доступ и правила Firebase.')
    }
  }

  async function saveShipment(next: Shipment, message: string) {
    if (!database) {
      if (!demoMode) return
      const nextShipments = shipments.map((shipment) => shipment.code === next.code ? next : shipment)
      writeDemoData(demoShipmentsKey, nextShipments)
      setShipments(nextShipments)
      showNotice(message)
      return
    }
    try {
      await update(ref(database), { [`shipments/${next.code}`]: next, [`publicTracking/${next.code}`]: getPublicShipment(next) })
      showNotice(message)
    } catch {
      showNotice('Изменение не сохранено. Проверьте права администратора Firebase.')
    }
  }

  function changeStatus(index: number) {
    if (!selectedShipment) return
    const timestamp = currentTimestamp()
    const next: Shipment = {
      ...selectedShipment,
      statusIndex: index,
      statusStartedAt: timestamp,
      pausedMs: 0,
      isPaused: false,
      pausedAt: undefined,
      isStopped: index === shipmentStatuses.length - 1,
      statusHistory: [...(selectedShipment.statusHistory ?? []), { statusIndex: index, at: timestamp }],
    }
    void saveShipment(next, 'Статус посылки обновлён')
  }

  function togglePause() {
    if (!selectedShipment) return
    const timestamp = currentTimestamp()
    const next: Shipment = selectedShipment.isPaused
      ? { ...selectedShipment, isPaused: false, pausedMs: selectedShipment.pausedMs + timestamp - (selectedShipment.pausedAt ?? timestamp), pausedAt: undefined }
      : { ...selectedShipment, isPaused: true, pausedAt: timestamp }
    void saveShipment(next, selectedShipment.isPaused ? 'Доставка возобновлена' : 'Доставка поставлена на паузу')
  }

  function toggleStop() {
    if (!selectedShipment) return
    const timestamp = currentTimestamp()
    const next: Shipment = selectedShipment.isStopped
      ? { ...selectedShipment, isStopped: false, pausedMs: selectedShipment.pausedMs + timestamp - (selectedShipment.stoppedAt ?? timestamp), stoppedAt: undefined }
      : { ...selectedShipment, isStopped: true, stoppedAt: timestamp }
    void saveShipment(next, next.isStopped ? 'Автообновление остановлено' : 'Автообновление возобновлено')
  }

  async function deleteShipment() {
    if ((!database && !demoMode) || !selectedShipment || !window.confirm(`Удалить посылку ${selectedShipment.code}?`)) return
    if (database) {
      await update(ref(database), { [`shipments/${selectedShipment.code}`]: null, [`publicTracking/${selectedShipment.code}`]: null })
    } else {
      const nextShipments = shipments.filter((shipment) => shipment.code !== selectedShipment.code)
      writeDemoData(demoShipmentsKey, nextShipments)
      setShipments(nextShipments)
    }
    setSelectedCode('')
    showNotice('Посылка удалена')
  }

  async function saveSurcharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedShipment) return
    const amount = Number(surchargeAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    await saveShipment({ ...selectedShipment, surcharge: { amount, message: surchargeMessage.trim() } }, 'Уведомление о доплате отправлено')
    setSurchargeAmount('')
    setSurchargeMessage('')
  }

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if ((!database && !demoMode) || !reviewDraft.author.trim() || !reviewDraft.text.trim()) return
    try {
      const reviewId = editingReviewId || (database ? push(ref(database, 'reviews')).key : crypto.randomUUID())
      if (!reviewId) throw new Error('Could not allocate review ID')
      const previousReview = reviews.find((item) => item.id === reviewId)
      const review = { ...reviewDraft, author: reviewDraft.author.trim(), text: reviewDraft.text.trim(), createdAt: previousReview?.createdAt ?? currentTimestamp() }
      if (database) {
        await update(ref(database), {
          [`reviews/${reviewId}`]: review,
          [`publicReviews/${reviewId}`]: review.isPublished ? review : null,
        })
      } else {
        const nextReviews = editingReviewId
          ? reviews.map((item) => item.id === reviewId ? { id: reviewId, ...review } : item)
          : [{ id: reviewId, ...review }, ...reviews]
        writeDemoData(demoReviewsKey, nextReviews)
        setReviews(nextReviews)
      }
      setReviewDraft({ author: '', rating: 5, text: '', isPublished: true })
      setEditingReviewId('')
      showNotice(editingReviewId ? 'Отзыв обновлён' : 'Отзыв добавлен')
    } catch {
      showNotice('Не удалось сохранить отзыв. Проверьте права администратора.')
    }
  }

  function editReview(review: AdminReview) {
    setEditingReviewId(review.id)
    setReviewDraft({ author: review.author, rating: review.rating, text: review.text, isPublished: review.isPublished })
  }

  async function deleteReview(id: string) {
    if ((!database && !demoMode) || !window.confirm('Удалить этот отзыв?')) return
    if (database) {
      await update(ref(database), { [`reviews/${id}`]: null, [`publicReviews/${id}`]: null })
    } else {
      const nextReviews = reviews.filter((review) => review.id !== id)
      writeDemoData(demoReviewsKey, nextReviews)
      setReviews(nextReviews)
    }
    showNotice('Отзыв удалён')
  }

  if (!authReady) return <div className="boot-screen"><span className="boot-seal">货</span><p>Загрузка панели…</p></div>

  if (!user && !demoMode) return <div className="login-page">
    <div className="login-art"><div className="login-art-top"><span className="brand-seal">货</span><span>货运管理 · CARGO 7</span></div><div className="login-art-center"><span className="red-mark">龙</span><p>从中国到白俄罗斯</p><strong>Путь каждой<br />посылки под контролем.</strong><div className="login-route"><span>CN</span><i /><i /><i /><span>BY</span></div></div><div className="login-art-bottom">CARGO OPERATIONS · 2026</div></div>
    <div className="login-side"><div className="login-box"><p className="section-kicker">УПРАВЛЕНИЕ ДОСТАВКОЙ</p><h1>Вход в панель</h1><p className="login-subtitle">Войдите с аккаунтом администратора.</p>
      <form onSubmit={login} className="login-form"><label>Ник или email администратора<input type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" required /></label><label>Пароль Firebase<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{loginError && <p className="form-error">{loginError}</p>}<button className="primary-button" type="submit">Войти <ArrowDownUp size={16} /></button></form>
      <p className="login-foot"><ShieldCheck size={15} /> {auth && database ? 'Вход Firebase Authentication' : 'Демо-вход для просмотра'}</p></div><span className="login-version">CARGO 7 <span>•</span> ADMIN</span></div>
  </div>

  return <div className="admin-shell">
    <aside className="sidebar">
      <a href="#dashboard" className="admin-brand"><span className="brand-seal">货</span><span><strong>cargo<span>7</span></strong><small>ADMIN CONSOLE</small></span></a>
      <p className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</p>
      <nav className="side-nav">
        <button className={activeView === 'shipments' ? 'active' : ''} onClick={() => setActiveView('shipments')}><Box size={17} /> Посылки <span className="nav-count">{shipments.length}</span></button>
        <button className={activeView === 'reviews' ? 'active' : ''} onClick={() => setActiveView('reviews')}><MessageSquareText size={17} /> Отзывы <span className="nav-count">{reviews.length}</span></button>
      </nav>
      <div className="sidebar-bottom"><span className="admin-avatar">{(user?.email ?? adminNickname).slice(0, 1).toUpperCase()}</span><div className="admin-identity"><strong>Администратор</strong><small>{demoMode ? adminNickname : user?.email}</small></div><button className="logout-button" onClick={() => { if (demoMode) { setDemoMode(false); setSelectedCode('') } else if (auth) void signOut(auth) }} title="Выйти" aria-label="Выйти"><LogOut size={17} /></button></div>
    </aside>

    <main className="admin-main" id="dashboard">
      <header className="page-header"><div><p className="section-kicker">货运管理 · ОПЕРАЦИИ</p><h1>{activeView === 'shipments' ? 'Управление посылками' : 'Отзывы клиентов'}</h1></div><div className="header-status"><span className="online-dot" /> {demoMode ? 'Демо: только этот браузер' : 'База обновляется в реальном времени'}</div></header>
      {demoMode && <div className="demo-banner"><CircleAlert size={16} />Демо-режим: данные сохраняются только в этом браузере и не отправляются клиентам.</div>}
      {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}

      {activeView === 'shipments' ? <>
        <section className="stats-row" aria-label="Статистика посылок"><div className="stat-card"><span className="stat-icon coral"><Truck size={18} /></span><div><strong>{activeCount}</strong><small>В доставке</small></div></div><div className="stat-card"><span className="stat-icon green"><Check size={18} /></span><div><strong>{readyCount}</strong><small>Готовы к выдаче</small></div></div><div className="stat-card"><span className="stat-icon amber"><Pause size={17} /></span><div><strong>{pausedCount}</strong><small>На паузе</small></div></div><div className="stats-note"><Clock3 size={15} /> Авиа 5–12 дней <i /> Автобус 10–18 дней</div></section>
        <section className="workspace">
          <div className="shipment-list-pane">
            <div className="list-toolbar"><div><h2>Все посылки</h2><span>{filteredShipments.length} записей</span></div><button className="primary-button compact" onClick={() => { setFormError(''); setCreateOpen(true) }}><Plus size={17} /> Новая посылка</button></div>
            <label className="search-box"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Трек-код или ник клиента" /></label>
            <div className="shipments-table-wrap"><table className="shipments-table"><thead><tr><th>ПОСЫЛКА</th><th>СТАТУС</th><th>МАРШРУТ</th><th></th></tr></thead><tbody>
              {filteredShipments.map((shipment) => {
                const status = getCurrentStatusIndex(shipment, now)
                return <tr key={shipment.code} className={selectedCode === shipment.code ? 'selected' : ''} onClick={() => setSelectedCode(shipment.code)}><td><strong>{shipment.code}</strong><small>{shipment.customerNickname} · {shipment.weightKg} кг</small></td><td><span className={`status-pill ${shipment.isPaused ? 'paused' : status === shipmentStatuses.length - 1 ? 'ready' : ''}`}>{shipment.isPaused ? 'На паузе' : shipmentStatuses[status]}</span></td><td><span className="method-cell">{shipment.shippingMethod === 'air' ? <Plane size={14} /> : <BusFront size={14} />}{shipment.deliveryDays} дн.</span></td><td><ChevronDown className="row-chevron" size={16} /></td></tr>
              })}
              {filteredShipments.length === 0 && <tr><td colSpan={4} className="empty-table">{shipments.length ? 'Ничего не найдено.' : 'Добавьте первую посылку.'}</td></tr>}
            </tbody></table></div>
          </div>

          <aside className="detail-pane">
            {selectedShipment ? <>
              <div className="detail-heading"><div><p className="section-kicker">КАРТОЧКА ПОСЫЛКИ</p><h2>{selectedShipment.code}</h2></div><button className="icon-button" onClick={() => setSelectedCode('')} aria-label="Закрыть карточку"><X size={18} /></button></div>
              <div className="customer-summary"><span className="customer-avatar">{selectedShipment.customerNickname.slice(0, 1).toUpperCase()}</span><div><strong>{selectedShipment.customerNickname}</strong><small>Добавлена {new Date(selectedShipment.createdAt).toLocaleDateString('ru-RU')}</small></div></div>
              <div className="shipment-facts"><div><span>ВЕС</span><strong>{selectedShipment.weightKg} кг</strong></div><div><span>ОПЛАЧЕНО</span><strong>€{selectedShipment.paidAmount.toFixed(2)}</strong></div><div><span>ДОСТАВКА</span><strong>{selectedShipment.shippingMethod === 'air' ? 'Авиа' : 'Автобус'} · {selectedShipment.deliveryDays} дн.</strong></div></div>
              <label className="field-label">Текущий статус<select value={getCurrentStatusIndex(selectedShipment, now)} onChange={(event) => changeStatus(Number(event.target.value))}>{shipmentStatuses.map((status, index) => <option key={status} value={index}>{status}</option>)}</select></label>
              <div className="control-row"><button className={`secondary-button ${selectedShipment.isPaused ? 'resume' : ''}`} onClick={togglePause} disabled={selectedShipment.isStopped}><Pause size={15} />{selectedShipment.isPaused ? 'Продолжить' : 'Пауза'}</button><button className={`secondary-button ${selectedShipment.isStopped ? 'resume' : ''}`} onClick={toggleStop} disabled={selectedShipment.isPaused}><Clock3 size={15} />{selectedShipment.isStopped ? 'Автостатус' : 'Остановить'}</button><button className="danger-icon" onClick={deleteShipment} aria-label="Удалить посылку" title="Удалить"><Trash2 size={16} /></button></div>
              <form className="surcharge-form" onSubmit={saveSurcharge}><h3><BadgeEuro size={16} /> Запросить доплату</h3><div className="surcharge-fields"><label>Сумма, €<input type="number" min="0.01" step="0.01" value={surchargeAmount} onChange={(event) => setSurchargeAmount(event.target.value)} placeholder="0,00" required /></label><label>Сообщение клиенту<input value={surchargeMessage} onChange={(event) => setSurchargeMessage(event.target.value)} placeholder="Например, доплата за вес" /></label></div><button className="secondary-button full-width" type="submit">Отправить уведомление</button>{selectedShipment.surcharge && <button type="button" className="clear-surcharge" onClick={() => { const next = { ...selectedShipment }; delete next.surcharge; void saveShipment(next, 'Запрос доплаты снят') }}>Снять запрос €{selectedShipment.surcharge.amount.toFixed(2)}</button>}</form>
              <p className="detail-footnote">Статус меняется автоматически по сроку доставки. Остановка и пауза применяются сразу.</p>
            </> : <div className="detail-empty"><span className="detail-empty-icon"><PackagePlus size={24} /></span><strong>Выберите посылку</strong><span>или создайте новую, чтобы управлять доставкой</span><button className="primary-button compact" onClick={() => { setFormError(''); setCreateOpen(true) }}><Plus size={16} /> Новая посылка</button></div>}
          </aside>
        </section>
      </> : <section className="reviews-workspace">
        <form className="review-editor" onSubmit={saveReview}><div className="editor-heading"><div><p className="section-kicker">ПУБЛИКАЦИЯ</p><h2>{editingReviewId ? 'Редактировать отзыв' : 'Добавить отзыв'}</h2></div>{editingReviewId && <button type="button" className="icon-button" onClick={() => { setEditingReviewId(''); setReviewDraft({ author: '', rating: 5, text: '', isPublished: true }) }} aria-label="Отменить редактирование"><X size={18} /></button>}</div><label>Имя клиента<input value={reviewDraft.author} onChange={(event) => setReviewDraft({ ...reviewDraft, author: event.target.value })} required /></label><label>Текст отзыва<textarea rows={4} value={reviewDraft.text} onChange={(event) => setReviewDraft({ ...reviewDraft, text: event.target.value })} required /></label><div className="review-editor-bottom"><label className="rating-control">Оценка<span>{[1, 2, 3, 4, 5].map((rating) => <button type="button" key={rating} className={rating <= reviewDraft.rating ? 'rated' : ''} onClick={() => setReviewDraft({ ...reviewDraft, rating })} aria-label={`${rating} звёзд`}><Star size={17} fill={rating <= reviewDraft.rating ? 'currentColor' : 'none'} /></button>)}</span></label><label className="publish-toggle"><input type="checkbox" checked={reviewDraft.isPublished} onChange={(event) => setReviewDraft({ ...reviewDraft, isPublished: event.target.checked })} /> Опубликован</label></div><button className="primary-button" type="submit">{editingReviewId ? 'Сохранить изменения' : 'Добавить отзыв'} <Check size={16} /></button></form>
        <div className="review-list-pane"><div className="list-toolbar"><div><h2>Все отзывы</h2><span>{reviews.length} записей</span></div></div>{reviews.length === 0 ? <div className="empty-reviews-admin"><Star size={21} /><strong>Отзывов пока нет</strong><span>Добавьте первый отзыв в форме рядом</span></div> : <div className="admin-review-list">{reviews.map((review) => <article className="admin-review" key={review.id}><div className="admin-review-header"><div><strong>{review.author}</strong><time>{new Date(review.createdAt).toLocaleDateString('ru-RU')}</time></div><span className={`publish-badge ${review.isPublished ? 'published' : ''}`}>{review.isPublished ? 'Опубликован' : 'Черновик'}</span></div><span className="admin-stars">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} fill={index < review.rating ? 'currentColor' : 'none'} />)}</span><p>{review.text}</p><div className="review-actions"><button onClick={() => editReview(review)}>Редактировать</button><button className="review-delete" onClick={() => deleteReview(review.id)}><Trash2 size={14} /> Удалить</button></div></article>)}</div>}</div>
      </section>}
    </main>

    {createOpen && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false) }}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="modal-title"><div><p className="section-kicker">НОВАЯ ПОСЫЛКА</p><h2 id="create-title">Создать отправление</h2></div><button className="icon-button" onClick={() => setCreateOpen(false)} aria-label="Закрыть"><X size={18} /></button></div><form onSubmit={createShipment}><label>Ник клиента<input value={newShipment.customerNickname} onChange={(event) => setNewShipment({ ...newShipment, customerNickname: event.target.value })} placeholder="Например, anna_shop" required /></label><div className="form-two-col"><label>Вес, кг<input type="number" min="0.01" step="0.01" value={newShipment.weightKg} onChange={(event) => setNewShipment({ ...newShipment, weightKg: event.target.value })} placeholder="2.50" required /></label><label>Оплачено, €<input type="number" min="0" step="0.01" value={newShipment.paidAmount} onChange={(event) => setNewShipment({ ...newShipment, paidAmount: event.target.value })} placeholder="0.00" required /></label></div><fieldset className="transport-choice"><legend>Способ доставки</legend><label className={newShipment.shippingMethod === 'air' ? 'chosen' : ''}><input type="radio" name="method" checked={newShipment.shippingMethod === 'air'} onChange={() => setNewShipment({ ...newShipment, shippingMethod: 'air' })} /><Plane size={17} /><span><strong>Авиа</strong><small>5–12 дней</small></span></label><label className={newShipment.shippingMethod === 'bus' ? 'chosen' : ''}><input type="radio" name="method" checked={newShipment.shippingMethod === 'bus'} onChange={() => setNewShipment({ ...newShipment, shippingMethod: 'bus' })} /><BusFront size={17} /><span><strong>Автобус</strong><small>10–18 дней</small></span></label></fieldset><label>Начальный статус<select value={newShipment.statusIndex} onChange={(event) => setNewShipment({ ...newShipment, statusIndex: Number(event.target.value) })}>{shipmentStatuses.map((status, index) => <option key={status} value={index}>{status}</option>)}</select></label>{formError && <p className="form-error">{formError}</p>}<button className="primary-button modal-submit" type="submit"><PackagePlus size={17} /> Создать трек-код</button></form></section></div>}
  </div>
}

export default App