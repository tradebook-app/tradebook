'use client';

import { useEffect, useState, useCallback } from 'react';

const BASE = '/api/scanner';

function pct(v: number | null) {
  if (v == null) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
}
function pctCls(v: number | null) {
  if (v == null) return 'text-gray-400';
  return v > 0 ? 'text-green-600 font-medium' : v < 0 ? 'text-red-600 font-medium' : 'text-gray-400';
}
function fmt$(v: number | null) {
  return v == null ? '—' : '$' + v.toFixed(2);
}
function rkBadge(v: number | null) {
  if (v == null) return <span className="text-gray-400">—</span>;
  const cls = v >= 75 ? 'bg-green-100 text-green-800' : v >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <span className={`inline-block w-7 text-center text-xs font-medium px-1 py-0.5 rounded ${cls}`}>{v}</span>;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type GapStock    = { ticker:string; name:string; gap:number; prePrice:number; preVol:number; prevClose:number; float:number|null; adr:number; atr:number; sector:string|null; industry:string|null; isPreMarket:boolean; isPostMarket:boolean };
type MomStock    = { ticker:string; name:string; price:number; m1:number; m3:number; m6:number; adr:number; atrPct:number; rs:number; sector:string|null; d50:number|null; d200:number|null };
type Theme       = { name:string; pct:number; stocks:{t:string;n:string;p:string;pctVal:number}[]; period:string };
type FundaStock  = { ticker:string; name:string; price:number; epsQoQ:number|null; epsYoY:number|null; revGrowth:number|null; epsRank:number|null; revRank:number|null; instRank:number|null; floatM:number|null; shortPct:number|null };

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ScannerPage() {
  const [tab, setTab]           = useState<'gap'|'momentum'|'themes'|'fundamentals'>('gap');
  const [gapData, setGapData]   = useState<GapStock[]>([]);
  const [momData, setMomData]   = useState<MomStock[]>([]);
  const [themeData, setThemeData] = useState<Theme[]>([]);
  const [fundaData, setFundaData] = useState<FundaStock[]>([]);
  const [loading, setLoading]   = useState<Record<string,boolean>>({gap:true,mom:true,themes:false,funda:false});
  const [error, setError]       = useState<Record<string,string>>({});
  const [themeTime, setThemeTime] = useState<'today'|'1w'|'1m'|'ytd'>('today');
  const [openTheme, setOpenTheme] = useState<number>(-1);
  const [detail, setDetail]     = useState<any>(null);
  const [detailType, setDetailType] = useState<string>('');
  const [currentTicker, setCurrentTicker] = useState('');

  // Gap filters
  const [gDir, setGDir]     = useState('both');
  const [gMin, setGMin]     = useState(1);
  const [gMax, setGMax]     = useState(50);
  const [gPMin, setGPMin]   = useState(5);
  const [gPMax, setGPMax]   = useState(1000);
  const [gVol, setGVol]     = useState(0);
  const [gFloat, setGFloat] = useState(500);
  const [gAdr, setGAdr]     = useState(0);

  // Momentum filters
  const [mM1, setMM1]   = useState(-100);
  const [mM3, setMM3]   = useState(-100);
  const [mM6, setMM6]   = useState(-100);
  const [mAdr, setMAdr] = useState(0);
  const [mPMin, setMPMin] = useState(5);
  const [mPMax, setMPMax] = useState(5000);
  const [mRs, setMRs]   = useState(1);

  // Funda filters
  const [fEps, setFEps]     = useState(1);
  const [fRev, setFRev]     = useState(1);
  const [fInst, setFInst]   = useState(1);
  const [fFloat, setFFFloat] = useState(1000);
  const [fShort, setFShort] = useState(0);

  const [clock, setClock] = useState('');

  // Clock
  useEffect(() => {
    const update = () => {
      const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const h = et.getHours(), m = et.getMinutes();
      const status = h < 4 ? 'Closed' : (h < 9 || (h === 9 && m < 30)) ? 'Pre-Market' : h < 16 ? 'Market Open' : 'After Hours';
      setClock(`${et.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})} ET — ${status}`);
    };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, []);

  // Load gap data
  const loadGaps = useCallback(async () => {
    setLoading(l => ({...l, gap:true}));
    setError(e => ({...e, gap:''}));
    try {
      const res = await fetch(`${BASE}/gaps`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGapData(data);
    } catch(e:any) { setError(err => ({...err, gap:e.message})); }
    finally { setLoading(l => ({...l, gap:false})); }
  }, []);

  // Load momentum
  const loadMom = useCallback(async () => {
    setLoading(l => ({...l, mom:true}));
    try {
      const res = await fetch(`${BASE}/momentum`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMomData(data);
    } catch(e:any) { setError(err => ({...err, mom:e.message})); }
    finally { setLoading(l => ({...l, mom:false})); }
  }, []);

  // Load themes
  const loadThemes = useCallback(async (period: string) => {
    setLoading(l => ({...l, themes:true}));
    setError(e => ({...e, themes:''}));
    try {
      const res = await fetch(`${BASE}/themes?period=${period}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setThemeData(data);
    } catch(e:any) { setError(err => ({...err, themes:e.message})); }
    finally { setLoading(l => ({...l, themes:false})); }
  }, []);

  // Load fundamentals
  const loadFunda = useCallback(async () => {
    setLoading(l => ({...l, funda:true}));
    try {
      const res = await fetch(`${BASE}/fundamentals`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFundaData(data);
    } catch(e:any) { setError(err => ({...err, funda:e.message})); }
    finally { setLoading(l => ({...l, funda:false})); }
  }, []);

  useEffect(() => { loadGaps(); loadMom(); }, []);
  useEffect(() => { if (tab === 'themes') loadThemes(themeTime); }, [tab]);
  useEffect(() => { if (tab === 'fundamentals' && fundaData.length === 0) loadFunda(); }, [tab]);
  useEffect(() => { loadThemes(themeTime); }, [themeTime]);

  // Filtered gap data
  const filteredGaps = gapData.filter(r => {
    if (gDir === 'up' && r.gap < 0) return false;
    if (gDir === 'down' && r.gap > 0) return false;
    if (Math.abs(r.gap) < gMin || Math.abs(r.gap) > gMax) return false;
    if (r.prePrice < gPMin || r.prePrice > gPMax) return false;
    if ((r.preVol || 0) < gVol) return false;
    if (r.float && r.float > gFloat) return false;
    if (r.adr < gAdr) return false;
    return true;
  }).sort((a,b) => Math.abs(b.gap) - Math.abs(a.gap));

  const filteredMom = momData.filter(r =>
    r.m1 >= mM1 && r.m3 >= mM3 && r.m6 >= mM6 && r.adr >= mAdr &&
    r.price >= mPMin && r.price <= mPMax && r.rs >= mRs
  ).sort((a,b) => b.rs - a.rs);

  const filteredFunda = fundaData.filter(r =>
    (r.epsRank||0) >= fEps && (r.revRank||0) >= fRev && (r.instRank||0) >= fInst &&
    (!r.floatM || r.floatM <= fFloat) && (!r.shortPct || r.shortPct >= fShort)
  );

  const sidebarInput = "w-full h-7 text-xs px-2 border border-gray-200 rounded bg-white focus:outline-none focus:border-blue-500";
  const sidebarLabel = "text-xs text-gray-500 mb-1 block";
  const sidebarGroup = "mb-3";

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="text-sm font-medium text-gray-900"><span className="text-blue-600">Sleek</span>Trade Scanner</div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"></span>
            Live data
          </span>
          <span>{clock}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {(['gap','momentum','themes','fundamentals'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs uppercase tracking-wide border-b-2 transition-colors ${tab===t ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'gap' ? 'Gap scanner' : t === 'fundamentals' ? 'Fundamentals' : t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">

        {/* ── GAP SCANNER ── */}
        {tab === 'gap' && (
          <div className="grid grid-cols-[165px_1fr] gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-3 self-start">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">Filters</div>
              <div className={sidebarGroup}><label className={sidebarLabel}>Direction</label>
                <select className={sidebarInput} value={gDir} onChange={e=>setGDir(e.target.value)}>
                  <option value="both">Gap Up + Down</option><option value="up">Gap Up only</option><option value="down">Gap Down only</option>
                </select>
              </div>
              <div className={sidebarGroup}><label className={sidebarLabel}>Gap %</label>
                <div className="flex gap-1"><input className={sidebarInput} type="number" value={gMin} onChange={e=>setGMin(+e.target.value)} placeholder="Min"/>
                <input className={sidebarInput} type="number" value={gMax} onChange={e=>setGMax(+e.target.value)} placeholder="Max"/></div>
              </div>
              <div className={sidebarGroup}><label className={sidebarLabel}>Price $</label>
                <div className="flex gap-1"><input className={sidebarInput} type="number" value={gPMin} onChange={e=>setGPMin(+e.target.value)} placeholder="Min"/>
                <input className={sidebarInput} type="number" value={gPMax} onChange={e=>setGPMax(+e.target.value)} placeholder="Max"/></div>
              </div>
              <div className={sidebarGroup}><label className={sidebarLabel}>Min vol K</label>
                <input className={sidebarInput} type="number" value={gVol} onChange={e=>setGVol(+e.target.value)}/>
              </div>
              <div className={sidebarGroup}><label className={sidebarLabel}>Max float M</label>
                <input className={sidebarInput} type="number" value={gFloat} onChange={e=>setGFloat(+e.target.value)}/>
              </div>
              <div className={sidebarGroup}><label className={sidebarLabel}>Min ADR %</label>
                <input className={sidebarInput} type="number" value={gAdr} onChange={e=>setGAdr(+e.target.value)}/>
              </div>
              <button onClick={loadGaps} className="w-full h-7 bg-blue-600 text-white text-xs font-medium rounded mt-1 hover:bg-blue-700">
                {loading.gap ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div>
              {error.gap && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-600">{error.gap}</div>}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{loading.gap ? 'Loading live data...' : `${filteredGaps.length} results · live data`}</span>
                <span className="text-xs text-gray-400">click row to expand</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium uppercase tracking-wide text-[10px]">Ticker</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium uppercase tracking-wide text-[10px]">Gap %</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium uppercase tracking-wide text-[10px]">Pre px</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium uppercase tracking-wide text-[10px]">Vol K</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium uppercase tracking-wide text-[10px]">Prev close</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium uppercase tracking-wide text-[10px]">Float</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium uppercase tracking-wide text-[10px]">ADR %</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium uppercase tracking-wide text-[10px]">Sector</th>
                  </tr></thead>
                  <tbody>
                    {loading.gap ? (
                      <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Fetching live data from Yahoo Finance...</td></tr>
                    ) : filteredGaps.length === 0 ? (
                      <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No results — adjust your filters</td></tr>
                    ) : filteredGaps.map(r => (
                      <tr key={r.ticker} onClick={() => { setDetail(r); setDetailType('gap'); setCurrentTicker(r.ticker); }}
                        className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors">
                        <td className="px-3 py-2"><div className="font-medium text-blue-600">{r.ticker}</div><div className="text-gray-400 text-[11px]">{r.name}</div></td>
                        <td className={`px-3 py-2 ${pctCls(r.gap)}`}>{pct(r.gap)}</td>
                        <td className="px-3 py-2">{fmt$(r.prePrice)}</td>
                        <td className="px-3 py-2">{r.preVol ? r.preVol.toLocaleString()+'K' : '—'}</td>
                        <td className="px-3 py-2">{fmt$(r.prevClose)}</td>
                        <td className="px-3 py-2">{r.float ? r.float+'M' : '—'}</td>
                        <td className={`px-3 py-2 ${pctCls(r.adr)}`}>{r.adr ? r.adr.toFixed(1)+'%' : '—'}</td>
                        <td className="px-3 py-2 text-gray-400 text-[11px]">{r.sector || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail && detailType === 'gap' && (
                <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-100">
                    <div><div className="text-xl font-medium">{detail.ticker}</div><div className="text-xs text-gray-400 mt-0.5">{detail.name}</div></div>
                    <div className="flex items-start gap-3">
                      <div className="text-right"><div className="text-lg font-medium">{fmt$(detail.prePrice)}</div>
                        <div className={`text-xs mt-0.5 ${pctCls(detail.gap)}`}>{pct(detail.gap)} {detail.isPreMarket ? 'pre-market' : detail.isPostMarket ? 'after-hours' : 'change'}</div>
                      </div>
                      <button onClick={() => setDetail(null)} className="text-gray-400 text-lg leading-none">×</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[['Gap %',<span className={pctCls(detail.gap)}>{pct(detail.gap)}</span>],['Prev close',fmt$(detail.prevClose)],['Pre-mkt vol',detail.preVol ? detail.preVol.toLocaleString()+'K':'—'],['Float',detail.float ? detail.float+'M':'—'],['ADR %',detail.adr ? detail.adr.toFixed(1)+'%':'—'],['ATR %',detail.atr ? detail.atr.toFixed(1)+'%':'—'],['Sector',detail.sector||'—'],['Industry',detail.industry||'—']].map(([l,v]:any) => (
                      <div key={l} className="bg-gray-50 rounded p-2"><div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{l}</div><div className="text-sm font-medium">{v}</div></div>
                    ))}
                  </div>
                  <a href={`https://www.tradingview.com/chart/?symbol=${detail.ticker}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 text-xs rounded hover:bg-blue-600 hover:text-white transition-colors">
                    Open on TradingView →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MOMENTUM ── */}
        {tab === 'momentum' && (
          <div className="grid grid-cols-[165px_1fr] gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-3 self-start">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">Filters</div>
              {[['Min 1M %',mM1,setMM1],['Min 3M %',mM3,setMM3],['Min 6M %',mM6,setMM6],['Min ADR %',mAdr,setMAdr],['Min RS rank',mRs,setMRs]].map(([l,v,s]:any)=>(
                <div key={l} className={sidebarGroup}><label className={sidebarLabel}>{l}</label>
                  <input className={sidebarInput} type="number" value={v} onChange={e=>s(+e.target.value)}/></div>
              ))}
              <div className={sidebarGroup}><label className={sidebarLabel}>Price $</label>
                <div className="flex gap-1">
                  <input className={sidebarInput} type="number" value={mPMin} onChange={e=>setMPMin(+e.target.value)} placeholder="Min"/>
                  <input className={sidebarInput} type="number" value={mPMax} onChange={e=>setMPMax(+e.target.value)} placeholder="Max"/>
                </div>
              </div>
              <button onClick={loadMom} className="w-full h-7 bg-blue-600 text-white text-xs font-medium rounded mt-1 hover:bg-blue-700">
                {loading.mom ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{loading.mom ? 'Loading...' : `${filteredMom.length} results · live data`}</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 border-b border-gray-200">
                    {['Ticker','1M %','3M %','6M %','ADR %','ATR %','RS rank','Sector'].map(h=>(
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {loading.mom ? <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Loading momentum data...</td></tr>
                    : filteredMom.map(r=>(
                      <tr key={r.ticker} onClick={()=>{setDetail(r);setDetailType('mom');setCurrentTicker(r.ticker);}}
                        className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors">
                        <td className="px-3 py-2"><div className="font-medium text-blue-600">{r.ticker}</div><div className="text-gray-400 text-[11px]">{r.name}</div></td>
                        <td className={`px-3 py-2 ${pctCls(r.m1)}`}>{pct(r.m1)}</td>
                        <td className={`px-3 py-2 ${pctCls(r.m3)}`}>{pct(r.m3)}</td>
                        <td className={`px-3 py-2 ${pctCls(r.m6)}`}>{pct(r.m6)}</td>
                        <td className="px-3 py-2 text-green-600 font-medium">{r.adr.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-green-600 font-medium">{r.atrPct.toFixed(1)}%</td>
                        <td className="px-3 py-2">{rkBadge(r.rs)}</td>
                        <td className="px-3 py-2 text-gray-400 text-[11px]">{r.sector||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail && detailType==='mom' && (
                <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-100">
                    <div><div className="text-xl font-medium">{detail.ticker}</div><div className="text-xs text-gray-400">{detail.name}</div></div>
                    <div className="flex gap-3"><div className="text-lg font-medium">{fmt$(detail.price)}</div>
                      <button onClick={()=>setDetail(null)} className="text-gray-400 text-lg">×</button></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[['1M perf',<span className={pctCls(detail.m1)}>{pct(detail.m1)}</span>],['3M perf',<span className={pctCls(detail.m3)}>{pct(detail.m3)}</span>],['6M perf',<span className={pctCls(detail.m6)}>{pct(detail.m6)}</span>],['ADR %',detail.adr.toFixed(1)+'%'],['ATR %',detail.atrPct.toFixed(1)+'%'],['RS rank',rkBadge(detail.rs)],['50D MA',fmt$(detail.d50)],['200D MA',fmt$(detail.d200)]].map(([l,v]:any)=>(
                      <div key={l} className="bg-gray-50 rounded p-2"><div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{l}</div><div className="text-sm font-medium">{v}</div></div>
                    ))}
                  </div>
                  <a href={`https://www.tradingview.com/chart/?symbol=${detail.ticker}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 text-xs rounded hover:bg-blue-600 hover:text-white transition-colors">
                    Open on TradingView →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── THEMES ── */}
        {tab === 'themes' && (
          <div className="grid grid-cols-[165px_1fr] gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-3 self-start">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">Time period</div>
              {(['today','1w','1m','ytd'] as const).map(p=>(
                <button key={p} onClick={()=>setThemeTime(p)}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded mb-1 border transition-colors ${themeTime===p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {p==='today'?'Today':p==='1w'?'1 week':p==='1m'?'1 month':'YTD'}
                </button>
              ))}
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">Click any theme to expand and see top stocks.</div>
            </div>
            <div>
              {error.themes && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-600">{error.themes}</div>}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{loading.themes ? 'Loading...' : `${themeData.length} themes · sorted strongest → weakest`}</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {loading.themes ? <div className="p-8 text-center text-xs text-gray-400">Loading theme data...</div>
                : themeData.map((d,i)=>{
                  const maxAbs = Math.max(...themeData.map(t=>Math.abs(t.pct)));
                  const barW = Math.round((Math.abs(d.pct)/maxAbs)*44);
                  const isPos = d.pct >= 0;
                  return (
                    <div key={d.name}>
                      <div onClick={()=>setOpenTheme(openTheme===i?-1:i)}
                        className={`flex items-center gap-3 px-3 py-2 border-b border-gray-100 cursor-pointer transition-colors ${openTheme===i?'bg-blue-50':'hover:bg-gray-50'}`}>
                        <span className="text-xs text-gray-800 w-36 flex-shrink-0 truncate">{d.name}</span>
                        <div className="flex-1 relative h-4 flex items-center">
                          <div className="absolute left-1/2 w-px h-4 bg-gray-300"></div>
                          <div className={`absolute h-2 rounded-sm ${isPos?'left-1/2':'right-1/2'}`}
                            style={{width:`${barW}%`,background:isPos?'#1a56db':'#a02020'}}></div>
                        </div>
                        <span className={`text-xs font-medium w-14 text-right flex-shrink-0 ${pctCls(d.pct)}`}>{pct(d.pct)}</span>
                        <span className="text-gray-400 text-xs">{openTheme===i?'▲':'▼'}</span>
                      </div>
                      {openTheme===i && (
                        <div className="bg-gray-50 border-b border-gray-200">
                          {(d.stocks||[]).map(s=>(
                            <div key={s.t} className="flex items-center justify-between px-4 py-1.5 border-b border-gray-100 last:border-0">
                              <span className="text-xs font-medium text-blue-600 w-12">{s.t}</span>
                              <span className="text-xs text-gray-400 flex-1 px-2 truncate">{s.n}</span>
                              <span className={`text-xs ${parseFloat(s.p)>=0?'text-green-600 font-medium':'text-red-600 font-medium'}`}>{s.p}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── FUNDAMENTALS ── */}
        {tab === 'fundamentals' && (
          <div className="grid grid-cols-[165px_1fr] gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-3 self-start">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">Filters</div>
              {[['Min EPS rank',fEps,setFEps],['Min rev rank',fRev,setFRev],['Min inst rank',fInst,setFInst],['Max float M',fFloat,setFFFloat],['Min short %',fShort,setFShort]].map(([l,v,s]:any)=>(
                <div key={l} className={sidebarGroup}><label className={sidebarLabel}>{l}</label>
                  <input className={sidebarInput} type="number" value={v} onChange={e=>s(+e.target.value)}/></div>
              ))}
              <button onClick={loadFunda} className="w-full h-7 bg-blue-600 text-white text-xs font-medium rounded mt-1 hover:bg-blue-700">
                {loading.funda ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{loading.funda ? 'Loading fundamentals (20-30 sec)...' : `${filteredFunda.length} results · live data`}</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 border-b border-gray-200">
                    {['Ticker','Price','EPS QoQ','EPS YoY','Rev growth','EPS rank','Rev rank','Inst rank','Float','Short %'].map(h=>(
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {loading.funda ? <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">Loading fundamentals... (may take 20-30 seconds)</td></tr>
                    : filteredFunda.map(r=>(
                      <tr key={r.ticker} onClick={()=>{setDetail(r);setDetailType('funda');setCurrentTicker(r.ticker);}}
                        className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors">
                        <td className="px-3 py-2"><div className="font-medium text-blue-600">{r.ticker}</div><div className="text-gray-400 text-[11px]">{r.name}</div></td>
                        <td className="px-3 py-2">{fmt$(r.price)}</td>
                        <td className={`px-3 py-2 ${pctCls(r.epsQoQ)}`}>{pct(r.epsQoQ)}</td>
                        <td className={`px-3 py-2 ${pctCls(r.epsYoY)}`}>{pct(r.epsYoY)}</td>
                        <td className={`px-3 py-2 ${pctCls(r.revGrowth)}`}>{pct(r.revGrowth)}</td>
                        <td className="px-3 py-2">{rkBadge(r.epsRank)}</td>
                        <td className="px-3 py-2">{rkBadge(r.revRank)}</td>
                        <td className="px-3 py-2">{rkBadge(r.instRank)}</td>
                        <td className="px-3 py-2">{r.floatM ? r.floatM+'M' : '—'}</td>
                        <td className={`px-3 py-2 ${r.shortPct&&r.shortPct>10?'text-green-600 font-medium':'text-gray-500'}`}>{r.shortPct!=null?r.shortPct.toFixed(1)+'%':'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
