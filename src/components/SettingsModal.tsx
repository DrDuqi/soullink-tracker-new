import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Palette, Languages, Gamepad2, Bell, Zap, Package, Info, Check, Settings as SettingsIcon,
  Monitor, RefreshCw, RotateCcw, Code2, MessageCircle, ScrollText, Download,
} from 'lucide-react'
import { useSettings, ACCENTS, type Accent, type Lang } from '../store/settingsStore'
import { LANGUAGES, useT } from '../lib/i18n'
import { companionInfo, APP_VERSION, LINKS } from '../lib/appInfo'
import { IN_COMPANION_WINDOW } from '../lib/companion'
import { DOWNLOADS } from '../lib/downloads'
import { useToastStore } from '../store/toastStore'
import type { RunMode } from '../lib/runMode'
import Modal, { SettingRow, Toggle } from './Modal'
import ChangelogModal from './ChangelogModal'
import CompanionVersion from './CompanionVersion'

type Section = 'appearance' | 'language' | 'gameplay' | 'notifications' | 'performance' | 'companion' | 'about'

interface UpdateResult { state: 'current' | 'available' | 'error' | 'dev'; current: string; latest?: string | null; error?: string; code?: string; detail?: string }
interface NativeApp { checkForUpdates?: () => Promise<UpdateResult>; startUpdate?: () => void }
function nativeApp(): NativeApp | null {
  return (typeof window !== 'undefined' ? (window as unknown as { soullinkNative?: NativeApp }).soullinkNative : null) ?? null
}

interface Opt<T> { value: T; label: string; hint?: string; icon?: React.ReactNode }
function Choice<T extends string | number>({ options, value, onChange, cols = 2 }: { options: Opt<T>[]; value: T; onChange: (v: T) => void; cols?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
      {options.map((o) => {
        const on = value === o.value
        return (
          <button key={String(o.value)} onClick={() => onChange(o.value)} className="text-left rounded-2xl border p-4 transition-all hover:border-pk-red/40"
            style={on ? { borderColor: 'var(--color-pk-red)', background: 'color-mix(in srgb, var(--color-pk-red) 12%, transparent)' } : { borderColor: '#2e2e42', background: '#1c1c26' }}>
            <div className="flex items-center gap-2">
              {o.icon}
              <span className="text-white font-bold text-sm">{o.label}</span>
              {on && <Check className="w-4 h-4 text-pk-red ml-auto" />}
            </div>
            {o.hint && <div className="text-slate-500 text-xs mt-1.5 leading-snug">{o.hint}</div>}
          </button>
        )
      })}
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-slate-400 font-black uppercase text-xs tracking-wider mb-3">{title}</h4>
      {children}
    </div>
  )
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const t = useT()
  const toast = useToastStore()
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('appearance')
  const [showChangelog, setShowChangelog] = useState(false)
  const [updChecking, setUpdChecking] = useState(false)
  const [upd, setUpd] = useState<UpdateResult | null>(null)
  const [showErrDetails, setShowErrDetails] = useState(false)

  async function checkUpdates() {
    const n = nativeApp(); if (!n?.checkForUpdates) return
    setUpdChecking(true); setUpd(null); setShowErrDetails(false)
    try { setUpd(await n.checkForUpdates()) }
    catch (e) { setUpd({ state: 'error', current: '', code: 'check_failed', detail: e instanceof Error ? e.message : String(e) }) }
    setUpdChecking(false)
  }
  // Map a clean, friendly message to an error code — never the raw electron/GitHub text.
  function errMsg(code?: string): string {
    if (code === 'offline') return t('settings.checkOffline')
    if (code === 'temporarily_unavailable') return t('settings.checkTemp')
    return t('settings.checkFailed')
  }

  const { data: comp, refetch, isFetching } = useQuery({ queryKey: ['companion-info'], queryFn: () => companionInfo(), staleTime: 30_000 })

  const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance', label: t('settings.appearance'), icon: <Palette className="w-4 h-4" /> },
    { id: 'language', label: t('settings.language'), icon: <Languages className="w-4 h-4" /> },
    { id: 'gameplay', label: t('settings.gameplay'), icon: <Gamepad2 className="w-4 h-4" /> },
    { id: 'notifications', label: t('settings.notifications'), icon: <Bell className="w-4 h-4" /> },
    { id: 'performance', label: t('settings.performance'), icon: <Zap className="w-4 h-4" /> },
    { id: 'companion', label: t('settings.companion'), icon: <Package className="w-4 h-4" /> },
    { id: 'about', label: t('settings.about'), icon: <Info className="w-4 h-4" /> },
  ]

  function reconnect() {
    refetch().then((r) => toast.show(r.data?.ok ? 'Companion verbunden.' : 'Companion nicht erreichbar.', r.data?.ok ? 'success' : 'error'))
  }
  function reSetup() { onClose(); navigate('/setup') }

  return (
    <>
    <Modal onClose={onClose} title={t('settings.title')} icon={<SettingsIcon className="w-5 h-5 text-pk-red" />} maxWidth="max-w-4xl">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <nav className="shrink-0 w-36 sm:w-52 border-r border-[#2e2e42] p-2 sm:p-3 overflow-y-auto modal-scroll bg-[#13131b]">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setSection(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold mb-1 transition-colors ${section === n.id ? 'bg-pk-red text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              {n.icon} <span className="truncate">{n.label}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-y-auto modal-scroll p-6 space-y-7">
          {section === 'appearance' && (
            <>
              <Block title={t('settings.appearance')}>
                <Choice<'dark' | 'oled'> value={s.theme} onChange={(v) => s.update({ theme: v })}
                  options={[
                    { value: 'dark', label: t('settings.darkMode'), hint: t('settings.darkModeHint'), icon: <Monitor className="w-4 h-4 text-slate-400" /> },
                    { value: 'oled', label: t('settings.oledMode'), hint: t('settings.oledHint'), icon: <Monitor className="w-4 h-4 text-slate-400" /> },
                  ]} />
              </Block>
              <Block title={t('settings.accent')}>
                <div className="flex flex-wrap gap-3">
                  {(Object.keys(ACCENTS) as Accent[]).map((key) => {
                    const a = ACCENTS[key]; const on = s.accent === key
                    return (
                      <button key={key} onClick={() => s.update({ accent: key })} title={a.label}
                        className="flex flex-col items-center gap-1.5">
                        <span className="w-11 h-11 rounded-full flex items-center justify-center transition-transform hover:scale-110" style={{ background: a.base, boxShadow: on ? `0 0 0 3px #16161f, 0 0 0 5px ${a.base}` : 'none' }}>
                          {on && <Check className="w-5 h-5 text-white" />}
                        </span>
                        <span className={`text-xs font-bold ${on ? 'text-white' : 'text-slate-500'}`}>{a.label}</span>
                      </button>
                    )
                  })}
                </div>
              </Block>
            </>
          )}

          {section === 'language' && (
            <Block title={t('settings.language')}>
              <Choice<Lang> value={s.language} onChange={(v) => s.update({ language: v })}
                options={(Object.keys(LANGUAGES) as Lang[]).map((l) => ({ value: l, label: LANGUAGES[l] }))} />
            </Block>
          )}

          {section === 'gameplay' && (
            <>
              <Block title={t('settings.defaultMode')}>
                <Choice<RunMode> value={s.defaultRunMode} onChange={(v) => s.update({ defaultRunMode: v })}
                  options={[
                    { value: 'manual', label: t('settings.manual'), icon: <Gamepad2 className="w-4 h-4 text-slate-400" /> },
                    { value: 'live_sync', label: t('settings.liveSync'), icon: <Zap className="w-4 h-4 text-slate-400" /> },
                  ]} />
              </Block>
              <Block title={t('settings.defaultPlayers')}>
                <Choice<2 | 3> value={s.defaultPlayers} onChange={(v) => s.update({ defaultPlayers: v })}
                  options={[{ value: 2, label: t('settings.players2') }, { value: 3, label: t('settings.players3') }]} />
              </Block>
            </>
          )}

          {section === 'notifications' && (
            <Block title={t('settings.notifications')}>
              <div className="divide-y divide-[#2e2e42]">
                <SettingRow title={t('settings.notifCaught')}><Toggle on={s.notif.caught} onChange={(v) => s.setNotif('caught', v)} /></SettingRow>
                <SettingRow title={t('settings.notifPartner')}><Toggle on={s.notif.partner} onChange={(v) => s.setNotif('partner', v)} /></SettingRow>
                <SettingRow title={t('settings.notifCompanion')}><Toggle on={s.notif.companion} onChange={(v) => s.setNotif('companion', v)} /></SettingRow>
                <SettingRow title={t('settings.notifUpdates')}><Toggle on={s.notif.updates} onChange={(v) => s.setNotif('updates', v)} /></SettingRow>
              </div>
            </Block>
          )}

          {section === 'performance' && (
            <Block title={t('settings.performance')}>
              <div className="divide-y divide-[#2e2e42]">
                <SettingRow title={t('settings.reduceMotion')} hint={t('settings.reduceMotionHint')}><Toggle on={s.perf.reduceMotion} onChange={(v) => s.setPerf('reduceMotion', v)} /></SettingRow>
                <SettingRow title={t('settings.disableBg')} hint={t('settings.disableBgHint')}><Toggle on={s.perf.disableBg} onChange={(v) => s.setPerf('disableBg', v)} /></SettingRow>
              </div>
            </Block>
          )}

          {section === 'companion' && (
            <Block title={t('settings.companion')}>
              <div className="mb-4"><CompanionVersion /></div>

              {/* Updates — real check (companion) or download CTA (website). */}
              {IN_COMPANION_WINDOW ? (
                <div className="rounded-2xl border border-[#2e2e42] bg-[#1c1c26] p-4 mb-3">
                  {(!upd || updChecking) ? (
                    <button onClick={checkUpdates} disabled={updChecking} className="lp-action w-full justify-center">
                      <RefreshCw className={`w-4 h-4 ${updChecking ? 'animate-spin' : ''}`} /> {updChecking ? t('settings.checking') : t('settings.checkUpdates')}
                    </button>
                  ) : upd.state === 'current' ? (
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-green-400 font-bold text-sm"><Check className="w-4 h-4" /> {t('settings.upToDate')} (v{upd.current})</span>
                        <button onClick={checkUpdates} className="text-xs font-bold text-slate-500 hover:text-white">{t('settings.recheck')}</button>
                      </div>
                      <div className="text-slate-500 text-xs mt-1">{t('settings.lastCheckOk')} · {t('settings.noUpdates')}</div>
                    </div>
                  ) : upd.state === 'available' ? (
                    <div>
                      <div className="flex items-center gap-2 text-white font-black"><Download className="w-4 h-4 text-pk-red" /> {t('settings.newVersionAvail')}: v{upd.latest}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{t('settings.youUse')} v{upd.current}.</div>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button onClick={() => nativeApp()?.startUpdate?.()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-sm text-white" style={{ background: '#CC0000' }}><Download className="w-4 h-4" /> {t('settings.updateNow')}</button>
                        <button onClick={() => setShowChangelog(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5"><ScrollText className="w-4 h-4" /> {t('settings.whatsNew')}</button>
                      </div>
                    </div>
                  ) : upd.state === 'dev' ? (
                    <div className="text-slate-400 text-sm">{t('settings.updatesPackagedOnly')}</div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-amber-400 text-sm">{errMsg(upd.code)}</span>
                        <button onClick={checkUpdates} className="text-xs font-bold text-white px-2.5 py-1 rounded-lg" style={{ background: 'var(--color-pk-red)' }}>{t('settings.tryAgain')}</button>
                      </div>
                      {upd.detail && (
                        <div className="mt-1.5">
                          <button onClick={() => setShowErrDetails((v) => !v)} className="text-[11px] font-bold text-slate-500 hover:text-slate-300">{showErrDetails ? t('settings.hideDetails') : t('settings.showDetails')}</button>
                          {showErrDetails && <pre className="mt-1.5 text-[10px] text-slate-500 bg-black/30 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-24">{upd.detail}</pre>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <a href={DOWNLOADS.companion} className="lp-action mb-3 inline-flex"><Download className="w-4 h-4" /> {t('settings.downloadCompanion')}</a>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <button onClick={reconnect} disabled={isFetching} className="lp-action"><RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> {t('settings.reconnect')}</button>
                <button onClick={reSetup} className="lp-action"><RotateCcw className="w-4 h-4" /> {t('settings.resetup')}</button>
              </div>
            </Block>
          )}

          {section === 'about' && (
            <Block title={t('settings.about')}>
              <div className="rounded-2xl border border-[#2e2e42] bg-[#1c1c26] divide-y divide-[#2e2e42] mb-4">
                <SettingRow title={t('settings.appVersion')}><span className="text-slate-400 text-sm font-mono">v{APP_VERSION}</span></SettingRow>
                <SettingRow title={t('settings.companionVersion')}><span className="text-slate-400 text-sm font-mono">{comp?.version ?? '—'}</span></SettingRow>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <button type="button" onClick={() => setShowChangelog(true)} className="lp-action"><ScrollText className="w-4 h-4" /> {t('menu.changelog')}</button>
                <a href={LINKS.github} target="_blank" rel="noreferrer" className="lp-action"><Code2 className="w-4 h-4" /> GitHub</a>
                {LINKS.discord
                  ? <a href={LINKS.discord} target="_blank" rel="noreferrer" className="lp-action"><MessageCircle className="w-4 h-4" /> Discord</a>
                  : <span className="lp-action opacity-50 cursor-default" title="Discord-Link folgt"><MessageCircle className="w-4 h-4" /> Discord <span className="text-[9px] font-black uppercase text-pk-yellow bg-pk-yellow/10 px-1.5 py-0.5 rounded">Bald</span></span>}
              </div>
            </Block>
          )}
        </div>
      </div>
    </Modal>
    {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </>
  )
}
