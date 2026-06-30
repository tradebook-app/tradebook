'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

const BASE = '/api/scanner';

function pct(v: number | null) {
  if (v == null) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
}
function pctColor(v: number | null): string {
  if (v == null) return 'var(--txt3)';
  return v > 0 ? 'var(--ac)' : v < 0 ? 'var(--red)' : 'var(--txt3)';
}
function fmt$(v: number | null) {
  return v == null ? '—' : '$' + v.toFixed(2);
}
function RkBadge({ v }: { v: number | null }) {
  if (v == null) return <span style={{ color: 'var(--txt3)' }}>—</span>;
  const bg    = v >= 80 ? 'rgba(16,185,129,.18)' : v >= 50 ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.18)';
  const color = v >= 80 ? '#10B981' : v >= 50 ? '#F59E0B' : '#EF4444';
  const bdr   = v >= 80 ? 'rgba(16,185,129,.35)' : v >= 50 ? 'rgba(245,158,11,.3)' : 'rgba(239,68,68,.35)';
  return <span style={{ display:'inline-block', minWidth:'24px', textAlign:'center', padding:'1px 4px', borderRadius:'4px', fontSize:'10px', fontWeight:700, background:bg, color, border:`1px solid ${bdr}` }}>{v}</span>;
}

type GapStock   = { ticker:string; name:string; gap:number; prePrice:number; preVol:number; prevClose:number; float:number|null; adr:number; atr:number; avgVol:number|null; mktCap:number|null; dollarVol:number|null; sector:string|null; industry:string|null; theme:string|null; isPreMarket:boolean; isPostMarket:boolean };
type MomStock   = { ticker:string; name:string; price:number; m1:number; m3:number; m6:number; adr:number; atrPct:number; atr:number; rs:number; epsRank:number|null; revRank:number|null; sector:string|null; industry:string|null; theme:string|null; d50:number|null; d200:number|null; isEtf?:boolean };
type SectorData = { name:string; etf:string; price:number; pct:number; pct1d:number; pct1w:number; pct1m:number; pct3m:number; pct6m:number; pctYtd:number };
type Theme      = { name:string; etf:string; sector:string; pct:number; pct1d:number; pct1w:number; pct1m:number; pct3m:number; pct6m:number; pctYtd:number; price:number; stocks:any[] };
type ThemeResponse = { sectors: SectorData[]; themes: Theme[] };
type FundaStock = { ticker:string; name:string; price:number; sector:string|null; industry:string|null; theme:string|null; mktCap:number|null; rs:number|null; epsRank:number|null; revRank:number|null; epsQ0:number|null; epsQ1:number|null; epsAnn:number|null; epsCombined:number|null; revQ0:number|null; revQ1:number|null; revGrowth:number|null; adr:number|null };

const INPUT: React.CSSProperties = { display:'block', width:'100%', height:'28px', background:'var(--bg4)', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt)', fontSize:'11px', padding:'0 8px', fontFamily:'var(--sans)', outline:'none', boxSizing:'border-box' };
const INPUT_HALF: React.CSSProperties = { display:'block', flex:1, minWidth:0, width:'auto', height:'28px', background:'var(--bg4)', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt)', fontSize:'11px', padding:'0 8px', fontFamily:'var(--sans)', outline:'none', boxSizing:'border-box' };
const LBL: React.CSSProperties   = { fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase' as const, color:'var(--txt3)', marginBottom:'3px', display:'block' };
const GRP: React.CSSProperties   = { marginBottom:'9px' };
const TH: React.CSSProperties    = { fontSize:'9px', fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase' as const, color:'var(--txt3)', padding:'6px 6px', textAlign:'left' as const, borderBottom:'1px solid var(--brd)', whiteSpace:'nowrap' as const, cursor:'pointer', userSelect:'none' as const };
const TD: React.CSSProperties    = { padding:'5px 6px', fontSize:'11px', borderBottom:'1px solid var(--brd)', whiteSpace:'nowrap' as const };

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', userSelect:'none' as const, padding:'7px 9px', background:'var(--bg4)', border:`1px solid ${checked ? 'var(--ac)' : 'var(--brd2)'}`, borderRadius:'var(--r)' }}
    >
      <span style={{ fontSize:'11px', color: checked ? 'var(--txt)' : 'var(--txt2)', fontWeight: checked ? 600 : 400 }}>{label}</span>
      <div style={{ position:'relative', width:'30px', height:'17px', borderRadius:'9px', background: checked ? 'var(--ac)' : 'var(--bg3)', border:`1px solid ${checked ? 'var(--ac)' : 'var(--brd2)'}`, transition:'.15s', flexShrink:0 }}>
        <div style={{ position:'absolute', top:'1px', left: checked ? '14px' : '1px', width:'13px', height:'13px', borderRadius:'50%', background: checked ? '#000' : 'var(--txt3)', transition:'.15s' }}/>
      </div>
    </div>
  );
}

function parseKMB(val: string): number {
  const s = val.trim().toUpperCase();
  if (!s || s === '0') return 0;
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  if (s.endsWith('B')) return num * 1_000_000_000;
  if (s.endsWith('M')) return num * 1_000_000;
  if (s.endsWith('K')) return num * 1_000;
  return num;
}

export function Scanner() {
  const [tab,       setTab]       = useState<'gap'|'momentum'|'themes'|'fundamentals'>('momentum');
  const [gapData,   setGapData]   = useState<GapStock[]>([]);
  const [momData,   setMomData]   = useState<MomStock[]>([]);
  const [themeResp, setThemeResp] = useState<ThemeResponse>({ sectors:[], themes:[] });
  const [fundaData, setFundaData] = useState<FundaStock[]>([]);
  const [loading,   setLoading]   = useState<Record<string,boolean>>({ gap:true, mom:true, themes:false, funda:false });
  const [error,     setError]     = useState<Record<string,string>>({});
  const [themeTime, setThemeTime] = useState<'today'|'1w'|'1m'|'3m'|'6m'|'ytd'>('today');
  const [openTheme, setOpenTheme] = useState(-1);
  const [detail,    setDetail]    = useState<any>(null);
  const [detailType,setDetailType]= useState('');
  const [ticker,    setTicker]    = useState('');
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [fundaLoaded, setFundaLoaded] = useState(false);
  const [chartStock, setChartStock] = useState<any|null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const [mSortCol, setMSortCol] = useState('rs');
  const [mSortAsc, setMSortAsc] = useState(false);

  const [gDir,setGDir]=useState('both');
  const [gGapMin,setGGapMin]=useState(0); const [gGapMax,setGGapMax]=useState(0);
  const [gPriceMin,setGPriceMin]=useState(0); const [gPriceMax,setGPriceMax]=useState(0);
  const [gVolMin,setGVolMin]=useState(0); const [gVolMax,setGVolMax]=useState(0);
  const [gFloatMin,setGFloatMin]=useState(0); const [gFloatMax,setGFloatMax]=useState(0);
  const [gAdrMin,setGAdrMin]=useState(0); const [gAdrMax,setGAdrMax]=useState(0);
  const [gAtrMin,setGAtrMin]=useState(0); const [gAtrMax,setGAtrMax]=useState(0);
  const [gAvgVolMin,setGAvgVolMin]=useState(''); const [gAvgVolMax,setGAvgVolMax]=useState('');
  const [gMktCapMin,setGMktCapMin]=useState(''); const [gMktCapMax,setGMktCapMax]=useState('');
  const [gDolVolMin,setGDolVolMin]=useState(''); const [gDolVolMax,setGDolVolMax]=useState('');
  const [gSortCol,setGSortCol]=useState('gap'); const [gSortAsc,setGSortAsc]=useState(false);
  const [presets,setPresets]=useState<{name:string;filters:any}[]>([]);
  const [presetName,setPresetName]=useState('');

  useEffect(()=>{
    try { const s=localStorage.getItem('st-scanner-presets'); if(s) setPresets(JSON.parse(s)); } catch {}
    try { const s=localStorage.getItem('st-mom-presets'); if(s) setMPresets(JSON.parse(s)); } catch {}
    try { const s=localStorage.getItem('st-funda-presets'); if(s) setFPresets(JSON.parse(s)); } catch {}
  },[]);

  function currentFilters() { return { gDir,gGapMin,gGapMax,gPriceMin,gPriceMax,gVolMin,gVolMax,gFloatMin,gFloatMax,gAdrMin,gAdrMax,gAtrMin,gAtrMax,gAvgVolMin,gAvgVolMax,gMktCapMin,gMktCapMax,gDolVolMin,gDolVolMax }; }

  function savePreset() {
    const name = presetName.trim(); if (!name) return;
    const updated = [...presets.filter(p=>p.name!==name), { name, filters: currentFilters() }];
    setPresets(updated); try { localStorage.setItem('st-scanner-presets', JSON.stringify(updated)); } catch {}
    setPresetName('');
  }
  function loadPreset(p: {name:string;filters:any}) {
    const f = p.filters;
    if(f.gDir!==undefined) setGDir(f.gDir);
    if(f.gGapMin!==undefined) setGGapMin(f.gGapMin); if(f.gGapMax!==undefined) setGGapMax(f.gGapMax);
    if(f.gPriceMin!==undefined) setGPriceMin(f.gPriceMin); if(f.gPriceMax!==undefined) setGPriceMax(f.gPriceMax);
    if(f.gVolMin!==undefined) setGVolMin(f.gVolMin); if(f.gVolMax!==undefined) setGVolMax(f.gVolMax);
    if(f.gFloatMin!==undefined) setGFloatMin(f.gFloatMin); if(f.gFloatMax!==undefined) setGFloatMax(f.gFloatMax);
    if(f.gAdrMin!==undefined) setGAdrMin(f.gAdrMin); if(f.gAdrMax!==undefined) setGAdrMax(f.gAdrMax);
    if(f.gAtrMin!==undefined) setGAtrMin(f.gAtrMin); if(f.gAtrMax!==undefined) setGAtrMax(f.gAtrMax);
    if(f.gAvgVolMin!==undefined) setGAvgVolMin(f.gAvgVolMin); if(f.gAvgVolMax!==undefined) setGAvgVolMax(f.gAvgVolMax);
    if(f.gMktCapMin!==undefined) setGMktCapMin(f.gMktCapMin); if(f.gMktCapMax!==undefined) setGMktCapMax(f.gMktCapMax);
    if(f.gDolVolMin!==undefined) setGDolVolMin(f.gDolVolMin); if(f.gDolVolMax!==undefined) setGDolVolMax(f.gDolVolMax);
  }
  function deletePreset(name: string) {
    const updated = presets.filter(p=>p.name!==name); setPresets(updated);
    try { localStorage.setItem('st-scanner-presets', JSON.stringify(updated)); } catch {}
  }
  function resetFilters() {
    setGDir('both'); setGGapMin(0); setGGapMax(0); setGPriceMin(0); setGPriceMax(0);
    setGVolMin(0); setGVolMax(0); setGFloatMin(0); setGFloatMax(0);
    setGAdrMin(0); setGAdrMax(0); setGAtrMin(0); setGAtrMax(0);
    setGAvgVolMin(''); setGAvgVolMax(''); setGMktCapMin(''); setGMktCapMax('');
    setGDolVolMin(''); setGDolVolMax('');
  }

  const [mM1,setMM1]=useState<number|''>(''); const [mM3,setMM3]=useState<number|''>(''); const [mM6,setMM6]=useState<number|''>('');
  const [mAdr,setMAdr]=useState<number|''>(''); const [mPMin,setMPMin]=useState<number|''>(''); const [mPMax,setMPMax]=useState<number|''>('');
  const [mRs,setMRs]=useState<number|''>(''); const [mEps,setMEps]=useState<number|''>(''); const [mRev,setMRevR]=useState<number|''>('');
  const [mAvgVolMin,setMAvgVolMin]=useState(''); const [mAvgVolMax,setMAvgVolMax]=useState('');
  const [mDolVolMin,setMDolVolMin]=useState(''); const [mDolVolMax,setMDolVolMax]=useState('');
  const [mMktCapMin,setMMktCapMin]=useState(''); const [mMktCapMax,setMMktCapMax]=useState('');
  const [mAtrMin,setMAtrMin]=useState<number|''>(''); const [mAtrMax,setMAtrMax]=useState<number|''>('');
  const [mIncludeEtfs,setMIncludeEtfs]=useState(false);
  const [mPresets,setMPresets]=useState<{name:string;filters:any}[]>([]);
  const [mPresetName,setMPresetName]=useState('');
  const [fEpsRank,setFEpsRank]=useState<number|''>('');
  const [fRevRank,setFRevRank]=useState<number|''>('');
  const [fRs,setFRs]=useState<number|''>('');
  const [fEpsQ0Min,setFEpsQ0Min]=useState<number|''>('');
  const [fRevMin,setFRevMin]=useState<number|''>('');
  const [fSector,setFSector]=useState('');
  const [fIndustry,setFIndustry]=useState('');
  const [fTheme,setFTheme]=useState('');
  const [fSortCol, setFSortCol] = useState('rs');
  const [fSortAsc, setFSortAsc] = useState(false);
  const [fPresets,setFPresets]=useState<{name:string;filters:any}[]>([]);
  const [fPresetName,setFPresetName]=useState('');

  const load = useCallback(async (key: string, url: string, setter: (d:any)=>void) => {
    setLoading(l=>({...l,[key]:true})); setError(e=>({...e,[key]:''}));
    try {
      const res = await fetch(url); const data = await res.json();
      if (data.error) throw new Error(data.error);
      setter(data);
    } catch(e:any) { setError(err=>({...err,[key]:e.message})); }
    finally { setLoading(l=>({...l,[key]:false})); }
  }, []);

  useEffect(() => { load('mom',`${BASE}/momentum`,setMomData); }, []);
  useEffect(() => { if (tab==='themes'&&!themeLoaded) { setThemeLoaded(true); load('themes',`${BASE}/themes?period=today`,setThemeResp); } }, [tab]);
  useEffect(() => { if (tab==='fundamentals'&&!fundaLoaded) { setFundaLoaded(true); load('funda',`${BASE}/fundamentals`,setFundaData); } }, [tab]);
  useEffect(() => { if (themeLoaded) load('themes',`${BASE}/themes?period=${themeTime}`,d=>{ setThemeResp(d); setOpenTheme(-1); }); }, [themeTime]);

  const avgVolMinN = parseKMB(gAvgVolMin); const avgVolMaxN = parseKMB(gAvgVolMax);
  const mktCapMinN = parseKMB(gMktCapMin); const mktCapMaxN = parseKMB(gMktCapMax);

  const filteredGaps = gapData.filter(r => {
    if (gDir==='up' && r.gap<=0) return false; if (gDir==='down' && r.gap>=0) return false;
    if (gGapMin>0&&r.gap<gGapMin) return false; if (gGapMax>0&&r.gap>gGapMax) return false;
    if (gPriceMin>0&&r.prevClose<gPriceMin) return false; if (gPriceMax>0&&r.prevClose>gPriceMax) return false;
    if (gVolMin>0&&(r.preVol||0)<gVolMin) return false; if (gVolMax>0&&(r.preVol||0)>gVolMax) return false;
    if (gFloatMin>0&&r.float&&r.float<gFloatMin) return false; if (gFloatMax>0&&r.float&&r.float>gFloatMax) return false;
    if (gAdrMin>0&&r.adr<gAdrMin) return false; if (gAdrMax>0&&r.adr>gAdrMax) return false;
    if (gAtrMin>0&&r.atr<gAtrMin) return false; if (gAtrMax>0&&r.atr>gAtrMax) return false;
    if (avgVolMinN>0&&r.avgVol&&r.avgVol<avgVolMinN) return false; if (avgVolMaxN>0&&r.avgVol&&r.avgVol>avgVolMaxN) return false;
    if (mktCapMinN>0&&r.mktCap&&r.mktCap<mktCapMinN) return false; if (mktCapMaxN>0&&r.mktCap&&r.mktCap>mktCapMaxN) return false;
    const dMin=parseKMB(gDolVolMin); const dMax=parseKMB(gDolVolMax);
    if (dMin>0&&r.dollarVol&&r.dollarVol<dMin) return false; if (dMax>0&&r.dollarVol&&r.dollarVol>dMax) return false;
    return true;
  }).sort((a:any,b:any) => {
    const dir = gSortAsc?1:-1;
    if (gSortCol==='gap') return dir*(Math.abs(a.gap)-Math.abs(b.gap));
    if (gSortCol==='preVol') return dir*((a.preVol||0)-(b.preVol||0));
    if (gSortCol==='prevClose') return dir*((a.prevClose||0)-(b.prevClose||0));
    if (gSortCol==='float') return dir*((a.float||0)-(b.float||0));
    if (gSortCol==='adr') return dir*((a.adr||0)-(b.adr||0));
    if (gSortCol==='atr') return dir*((a.atr||0)-(b.atr||0));
    if (gSortCol==='industry') return dir*((a.industry||'').localeCompare(b.industry||''));
    if (gSortCol==='sector') return dir*((a.sector||'').localeCompare(b.sector||''));
    if (gSortCol==='ticker') return dir*a.ticker.localeCompare(b.ticker);
    return Math.abs(b.gap)-Math.abs(a.gap);
  });

  function handleMomSort(col: string) { if (mSortCol===col) setMSortAsc(a=>!a); else { setMSortCol(col); setMSortAsc(false); } }
  function momSortIcon(col: string) { if (mSortCol!==col) return ' ↕'; return mSortAsc?' ↑':' ↓'; }

  const mAvgVolMinN = parseKMB(mAvgVolMin); const mAvgVolMaxN = parseKMB(mAvgVolMax);
  const mDolVolMinN = parseKMB(mDolVolMin); const mDolVolMaxN = parseKMB(mDolVolMax);
  const mMktCapMinN = parseKMB(mMktCapMin); const mMktCapMaxN = parseKMB(mMktCapMax);

  function mCurrentFilters() {
    return { mM1,mM3,mM6,mAdr,mPMin,mPMax,mRs,mEps,mRev,mAtrMin,mAtrMax,mAvgVolMin,mAvgVolMax,mDolVolMin,mDolVolMax,mMktCapMin,mMktCapMax,mIncludeEtfs };
  }
  function saveMPreset() {
    const name = mPresetName.trim(); if (!name) return;
    const updated = [...mPresets.filter(p=>p.name!==name), { name, filters: mCurrentFilters() }];
    setMPresets(updated); try { localStorage.setItem('st-mom-presets', JSON.stringify(updated)); } catch {}
    setMPresetName('');
  }
  function loadMPreset(p: {name:string;filters:any}) {
    const f = p.filters;
    if(f.mM1!==undefined) setMM1(f.mM1); if(f.mM3!==undefined) setMM3(f.mM3); if(f.mM6!==undefined) setMM6(f.mM6);
    if(f.mAdr!==undefined) setMAdr(f.mAdr); if(f.mPMin!==undefined) setMPMin(f.mPMin); if(f.mPMax!==undefined) setMPMax(f.mPMax);
    if(f.mRs!==undefined) setMRs(f.mRs); if(f.mEps!==undefined) setMEps(f.mEps); if(f.mRev!==undefined) setMRevR(f.mRev);
    if(f.mAtrMin!==undefined) setMAtrMin(f.mAtrMin); if(f.mAtrMax!==undefined) setMAtrMax(f.mAtrMax);
    if(f.mAvgVolMin!==undefined) setMAvgVolMin(f.mAvgVolMin); if(f.mAvgVolMax!==undefined) setMAvgVolMax(f.mAvgVolMax);
    if(f.mDolVolMin!==undefined) setMDolVolMin(f.mDolVolMin); if(f.mDolVolMax!==undefined) setMDolVolMax(f.mDolVolMax);
    if(f.mMktCapMin!==undefined) setMMktCapMin(f.mMktCapMin); if(f.mMktCapMax!==undefined) setMMktCapMax(f.mMktCapMax);
    if(f.mIncludeEtfs!==undefined) setMIncludeEtfs(f.mIncludeEtfs);
  }
  function deleteMPreset(name: string) {
    const updated = mPresets.filter(p=>p.name!==name); setMPresets(updated);
    try { localStorage.setItem('st-mom-presets', JSON.stringify(updated)); } catch {}
  }
  function resetMFilters() {
    setMM1(''); setMM3(''); setMM6(''); setMAdr(''); setMPMin(''); setMPMax('');
    setMRs(''); setMEps(''); setMRevR(''); setMAtrMin(''); setMAtrMax('');
    setMAvgVolMin(''); setMAvgVolMax(''); setMDolVolMin(''); setMDolVolMax('');
    setMMktCapMin(''); setMMktCapMax(''); setMIncludeEtfs(false);
  }

  const filteredMom = momData
    .filter(r=>
      (mIncludeEtfs||!r.isEtf) &&
      (mM1===''||r.m1>=mM1) &&
      (mM3===''||r.m3>=mM3) &&
      (mM6===''||r.m6>=mM6) &&
      (mAdr===''||r.adr>=mAdr) &&
      (mPMin===''||r.price>=mPMin) &&
      (mPMax===''||r.price<=mPMax) &&
      (mRs===''||r.rs>=mRs) &&
      (mEps===''||r.epsRank==null||r.epsRank>=mEps) &&
      (mRev===''||r.revRank==null||r.revRank>=mRev) &&
      (mAtrMin===''||r.atr>=mAtrMin) &&
      (mAtrMax===''||r.atr<=mAtrMax) &&
      (mAvgVolMinN===0||!r.avgVol||r.avgVol>=mAvgVolMinN) &&
      (mAvgVolMaxN===0||!r.avgVol||r.avgVol<=mAvgVolMaxN) &&
      (mDolVolMinN===0||(r.price*r.avgVol)>=mDolVolMinN) &&
      (mDolVolMaxN===0||(r.price*r.avgVol)<=mDolVolMaxN) &&
      (mMktCapMinN===0||!r.mktCap||r.mktCap>=mMktCapMinN) &&
      (mMktCapMaxN===0||!r.mktCap||r.mktCap<=mMktCapMaxN)
    )
    .sort((a:any,b:any) => {
      const dir=mSortAsc?1:-1;
      if (mSortCol==='ticker') return dir*a.ticker.localeCompare(b.ticker);
      if (mSortCol==='m1') return dir*(a.m1-b.m1); if (mSortCol==='m3') return dir*(a.m3-b.m3); if (mSortCol==='m6') return dir*(a.m6-b.m6);
      if (mSortCol==='adr') return dir*(a.adr-b.adr); if (mSortCol==='atr') return dir*(a.atr-b.atr);
      if (mSortCol==='rs') return dir*(a.rs-b.rs);
      if (mSortCol==='epsRank') return dir*((a.epsRank??-1)-(b.epsRank??-1));
      if (mSortCol==='revRank') return dir*((a.revRank??-1)-(b.revRank??-1));
      if (mSortCol==='sector') return dir*((a.sector||'').localeCompare(b.sector||''));
      if (mSortCol==='industry') return dir*((a.industry||'').localeCompare(b.industry||''));
      if (mSortCol==='theme') return dir*((a.theme||'').localeCompare(b.theme||''));
      return b.rs-a.rs;
    });

  const filteredFunda = fundaData.filter((r:any)=>
    (fEpsRank===''||( r.epsRank!=null && r.epsRank>=fEpsRank)) &&
    (fRevRank===''||( r.revRank!=null && r.revRank>=fRevRank)) &&
    (fRs===''     ||( r.rs!=null      && r.rs>=fRs)) &&
    (fEpsQ0Min===''||(r.epsQ0!=null   && r.epsQ0>=fEpsQ0Min)) &&
    (fRevMin==='' ||(r.revGrowth!=null && r.revGrowth>=fRevMin)) &&
    (fIndustry==='' || (r.industry||'').toLowerCase().includes(fIndustry.toLowerCase())) &&
    (fSector==='' || (r.sector||'').toLowerCase().includes(fSector.toLowerCase())) &&
    (fTheme==='' || (r.theme||'').toLowerCase().includes(fTheme.toLowerCase()))
  ).sort((a:any,b:any) => {
    const dir = fSortAsc ? 1 : -1;
    if (fSortCol==='ticker')   return dir*a.ticker.localeCompare(b.ticker);
    if (fSortCol==='price')    return dir*((a.price??0)-(b.price??0));
    if (fSortCol==='epsQ0')    return dir*((a.epsQ0??-Infinity)-(b.epsQ0??-Infinity));
    if (fSortCol==='epsQ1')    return dir*((a.epsQ1??-Infinity)-(b.epsQ1??-Infinity));
    if (fSortCol==='epsAnn')   return dir*((a.epsAnn??-Infinity)-(b.epsAnn??-Infinity));
    if (fSortCol==='revGrowth')return dir*((a.revGrowth??-Infinity)-(b.revGrowth??-Infinity));
    if (fSortCol==='epsRank')  return dir*((a.epsRank??-1)-(b.epsRank??-1));
    if (fSortCol==='revRank')  return dir*((a.revRank??-1)-(b.revRank??-1));
    if (fSortCol==='rs')       return dir*((a.rs??-1)-(b.rs??-1));
    if (fSortCol==='industry') return dir*((a.industry||'').localeCompare(b.industry||''));
    if (fSortCol==='sector')   return dir*((a.sector||'').localeCompare(b.sector||''));
    if (fSortCol==='theme')    return dir*((a.theme||'').localeCompare(b.theme||''));
    return (b.rs??-1)-(a.rs??-1);
  });

  function handleFundaSort(col: string) { if (fSortCol===col) setFSortAsc(a=>!a); else { setFSortCol(col); setFSortAsc(false); } }

  function fCurrentFilters() {
    return { fEpsRank,fRevRank,fRs,fEpsQ0Min,fRevMin,fIndustry,fSector,fTheme };
  }
  function saveFPreset() {
    const name = fPresetName.trim(); if (!name) return;
    const updated = [...fPresets.filter(p=>p.name!==name), { name, filters: fCurrentFilters() }];
    setFPresets(updated); try { localStorage.setItem('st-funda-presets', JSON.stringify(updated)); } catch {}
    setFPresetName('');
  }
  function loadFPreset(p: {name:string;filters:any}) {
    const f = p.filters;
    if(f.fEpsRank!==undefined) setFEpsRank(f.fEpsRank); if(f.fRevRank!==undefined) setFRevRank(f.fRevRank);
    if(f.fRs!==undefined) setFRs(f.fRs); if(f.fEpsQ0Min!==undefined) setFEpsQ0Min(f.fEpsQ0Min);
    if(f.fRevMin!==undefined) setFRevMin(f.fRevMin); if(f.fIndustry!==undefined) setFIndustry(f.fIndustry);
    if(f.fSector!==undefined) setFSector(f.fSector); if(f.fTheme!==undefined) setFTheme(f.fTheme);
  }
  function deleteFPreset(name: string) {
    const updated = fPresets.filter(p=>p.name!==name); setFPresets(updated);
    try { localStorage.setItem('st-funda-presets', JSON.stringify(updated)); } catch {}
  }
  function fundaSortIcon(col: string) { if (fSortCol!==col) return ' ↕'; return fSortAsc ? ' ↑' : ' ↓'; }

  function openDetail(row: any, type: string, t: string) { setDetail(row); setDetailType(type); setTicker(t); }

  const SB_BTN = (label: string, action: ()=>void, load?: boolean) => (
    <button onClick={action} style={{ flex:1, height:'28px', background:'var(--ac)', color:'#000', border:'none', borderRadius:'var(--r)', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'var(--sans)' }}>
      {load ? 'Loading...' : label}
    </button>
  );

  const DetailPanel = () => !detail ? null : (
    <div style={{ marginTop:'12px', background:'var(--bg3)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', padding:'14px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'12px', paddingBottom:'10px', borderBottom:'1px solid var(--brd)' }}>
        <div>
          <div style={{ fontSize:'18px', fontWeight:700 }}>{detail.ticker}</div>
          <div style={{ fontSize:'10px', color:'var(--txt3)', marginTop:'2px' }}>{detail.name}</div>
        </div>
        <div style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'16px', fontWeight:700 }}>{fmt$(detail.prePrice??detail.price)}</div>
            <div style={{ fontSize:'11px', color:pctColor(detail.gap??detail.m6), marginTop:'2px' }}>{pct(detail.gap??detail.m6)}</div>
          </div>
          <button onClick={()=>setDetail(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt3)', fontSize:'16px' }}>×</button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'7px', marginBottom:'12px' }}>
        {(detailType==='gap' ? [
          ['Gap %',<span style={{color:pctColor(detail.gap)}}>{pct(detail.gap)}</span>],
          ['Prev close',fmt$(detail.prevClose)],['Pre-mkt vol',detail.preVol?detail.preVol.toLocaleString()+'K':'—'],
          ['Float',detail.float?detail.float+'M':'—'],['ADR %',detail.adr?detail.adr.toFixed(1)+'%':'—'],
          ['ATR',detail.atr?detail.atr.toFixed(1):'—'],['Sector',detail.sector||'—'],['Industry',detail.industry||'—'],
        ] : detailType==='mom' ? [
          ['1M',<span style={{color:pctColor(detail.m1)}}>{pct(detail.m1)}</span>],
          ['3M',<span style={{color:pctColor(detail.m3)}}>{pct(detail.m3)}</span>],
          ['6M',<span style={{color:pctColor(detail.m6)}}>{pct(detail.m6)}</span>],
          ['ADR %',detail.adr.toFixed(1)+'%'],['ATR',detail.atr!=null?detail.atr.toFixed(2):'—'],
          ['RS rank',<RkBadge v={detail.rs}/>],['EPS rank',<RkBadge v={detail.epsRank}/>],['Rev rank',<RkBadge v={detail.revRank}/>],
          ['50D MA',fmt$(detail.d50)],['200D MA',fmt$(detail.d200)],
          ['Sector',detail.sector||'—'],['Industry',detail.industry||'—'],['Theme',detail.theme||'—'],
        ] : [
          ['EPS QoQ',<span style={{color:pctColor(detail.epsQoQ)}}>{pct(detail.epsQoQ)}</span>],
          ['EPS YoY',<span style={{color:pctColor(detail.epsYoY)}}>{pct(detail.epsYoY)}</span>],
          ['Rev growth',<span style={{color:pctColor(detail.revGrowth)}}>{pct(detail.revGrowth)}</span>],
          ['EPS rank',<RkBadge v={detail.epsRank}/>],['Rev rank',<RkBadge v={detail.revRank}/>],
          ['Inst rank',<RkBadge v={detail.instRank}/>],['Float',detail.floatM?detail.floatM+'M':'—'],
          ['Short %',detail.shortPct!=null?detail.shortPct.toFixed(1)+'%':'—'],
        ]).map(([l,v]:any)=>(
          <div key={l} style={{ background:'var(--bg4)', borderRadius:'var(--r)', padding:'7px 9px' }}>
            <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--txt3)', marginBottom:'3px' }}>{l}</div>
            <div style={{ fontSize:'12px', fontWeight:600, color:'var(--txt)' }}>{v}</div>
          </div>
        ))}
      </div>
      <a href={`https://www.tradingview.com/chart/?symbol=${ticker}`} target="_blank" rel="noreferrer"
        style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'6px 12px', background:'transparent', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt2)', fontSize:'11px', fontWeight:600, textDecoration:'none' }}>
        Open on TradingView →
      </a>
    </div>
  );

  // ── Chart Modal ──────────────────────────────────────────────────────────
  const ChartModal = () => {
    const [bars, setBars] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!chartStock) return;
      setLoading(true);
      setBars([]);
      fetch(`/api/chart?symbol=${chartStock.ticker}`)
        .then(r => r.json())
        .then(d => { setBars(d.bars || []); setLoading(false); })
        .catch(() => setLoading(false));
    }, [chartStock?.ticker]);

    useEffect(() => {
      if (!containerRef.current || !bars.length || loading) return;
      containerRef.current.innerHTML = '';

      // Wait for LightweightCharts to be available
      let attempts = 0;
      const tryRender = () => {
        const LWC = (window as any).LightweightCharts;
        if (!LWC) {
          if (attempts++ < 20) setTimeout(tryRender, 200);
          return;
        }

      const chart = LWC.createChart(containerRef.current, {
        width:  containerRef.current.clientWidth,
        height: 380,
        layout: { background: { color: '#131318' }, textColor: '#9999AA' },
        grid:   { vertLines: { color: '#252530' }, horzLines: { color: '#252530' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#252530' },
        timeScale: { borderColor: '#252530', timeVisible: true },
      });

      // Support both v3 (addCandlestickSeries) and v4 (addSeries) API
      const candleSeries = chart.addCandlestickSeries
        ? chart.addCandlestickSeries({ upColor:'#10B981', downColor:'#EF4444', borderUpColor:'#10B981', borderDownColor:'#EF4444', wickUpColor:'#10B981', wickDownColor:'#EF4444' })
        : chart.addSeries(LWC.CandlestickSeries, { upColor:'#10B981', downColor:'#EF4444', borderUpColor:'#10B981', borderDownColor:'#EF4444', wickUpColor:'#10B981', wickDownColor:'#EF4444' });
      candleSeries.setData(bars);

      const volSeries = chart.addHistogramSeries
        ? chart.addHistogramSeries({ color:'rgba(16,185,129,0.3)', priceFormat:{ type:'volume' }, priceScaleId:'volume' })
        : chart.addSeries(LWC.HistogramSeries, { color:'rgba(16,185,129,0.3)', priceFormat:{ type:'volume' }, priceScaleId:'volume' });
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volSeries.setData(bars.map((b:any) => ({
        time: b.time, value: b.volume,
        color: b.close >= b.open ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
      })));

      // 50MA
      const ma50data = bars.map((b:any, i:number) => {
        const slice = bars.slice(Math.max(0, i - 49), i + 1);
        const avg = slice.reduce((s:number, x:any) => s + x.close, 0) / slice.length;
        return { time: b.time, value: parseFloat(avg.toFixed(2)) };
      }).filter((_:any, i:number) => i >= 49);
      const ma50Series = chart.addLineSeries
        ? chart.addLineSeries({ color:'#F59E0B', lineWidth:1, priceLineVisible:false })
        : chart.addSeries(LWC.LineSeries, { color:'#F59E0B', lineWidth:1, priceLineVisible:false });
      ma50Series.setData(ma50data);

      // 200MA
      const ma200data = bars.map((b:any, i:number) => {
        const slice = bars.slice(Math.max(0, i - 199), i + 1);
        const avg = slice.reduce((s:number, x:any) => s + x.close, 0) / slice.length;
        return { time: b.time, value: parseFloat(avg.toFixed(2)) };
      }).filter((_:any, i:number) => i >= 199);
      const ma200Series = chart.addLineSeries
        ? chart.addLineSeries({ color:'#3B82F6', lineWidth:1, priceLineVisible:false })
        : chart.addSeries(LWC.LineSeries, { color:'#3B82F6', lineWidth:1, priceLineVisible:false });
      ma200Series.setData(ma200data);

      chart.timeScale().fitContent();

        return () => { try { chart.remove(); } catch {} };
      };
      tryRender();
    }, [bars, loading]);

    if (!chartStock) return null;

    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
        onClick={e=>{ if(e.target===e.currentTarget) setChartStock(null); }}>
        <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', width:'100%', maxWidth:'900px', overflow:'hidden' }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--brd)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
              <div>
                <div style={{ fontSize:'18px', fontWeight:700, color:'var(--txt)' }}>{chartStock.ticker}</div>
                <div style={{ fontSize:'11px', color:'var(--txt3)' }}>{chartStock.name}</div>
              </div>
              <div style={{ fontSize:'16px', fontWeight:700 }}>
                ${(chartStock.price || chartStock.prevClose || chartStock.prePrice || 0).toFixed(2)}
              </div>
              {chartStock.m1 != null && <div style={{ fontSize:'13px', fontWeight:600, color:pctColor(chartStock.m1) }}>{pct(chartStock.m1)} 1M</div>}
              {chartStock.gap != null && <div style={{ fontSize:'13px', fontWeight:600, color:pctColor(chartStock.gap) }}>{pct(chartStock.gap)} Gap</div>}
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                {chartStock.rs != null && <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                  <span style={{ fontSize:'8px', color:'var(--txt3)', letterSpacing:'.04em', textTransform:'uppercase' }}>RS</span>
                  <RkBadge v={chartStock.rs}/>
                </div>}
                {chartStock.epsRank != null && <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                  <span style={{ fontSize:'8px', color:'var(--txt3)', letterSpacing:'.04em', textTransform:'uppercase' }}>EPS</span>
                  <RkBadge v={chartStock.epsRank}/>
                </div>}
                {chartStock.revRank != null && <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                  <span style={{ fontSize:'8px', color:'var(--txt3)', letterSpacing:'.04em', textTransform:'uppercase' }}>Rev</span>
                  <RkBadge v={chartStock.revRank}/>
                </div>}
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <a href={`https://www.tradingview.com/chart/?symbol=${chartStock.ticker}`} target="_blank" rel="noreferrer"
                style={{ fontSize:'11px', color:'var(--txt3)', textDecoration:'none', border:'1px solid var(--brd2)', borderRadius:'var(--r)', padding:'4px 10px' }}>
                TradingView ↗
              </a>
              <button onClick={()=>setChartStock(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt3)', fontSize:'20px', lineHeight:1 }}>×</button>
            </div>
          </div>
          {/* Legend */}
          <div style={{ display:'flex', gap:'16px', padding:'8px 16px', borderBottom:'1px solid var(--brd)', fontSize:'10px' }}>
            <span style={{ color:'#F59E0B' }}>— 50 MA</span>
            <span style={{ color:'#3B82F6' }}>— 200 MA</span>
            <span style={{ color:'#10B981' }}>▲ Volume up</span>
            <span style={{ color:'#EF4444' }}>▼ Volume down</span>
          </div>
          {/* Chart */}
          <div style={{ padding:'0' }}>
            {loading
              ? <div style={{ height:'380px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--txt3)', fontSize:'12px' }}>Loading chart data...</div>
              : <div ref={containerRef} style={{ width:'100%', height:'380px' }}/>
            }
          </div>
          {/* Footer stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'1px', background:'var(--brd)', borderTop:'1px solid var(--brd)' }}>
            {[
              ['1M', pct(chartStock.m1), pctColor(chartStock.m1)],
              ['3M', pct(chartStock.m3), pctColor(chartStock.m3)],
              ['6M', pct(chartStock.m6), pctColor(chartStock.m6)],
              ['ADR%', chartStock.adr!=null ? chartStock.adr.toFixed(1)+'%' : '—', 'var(--ac)'],
              ['50 MA', chartStock.d50 ? '$'+chartStock.d50.toFixed(2) : '—', 'var(--txt2)'],
              ['200 MA', chartStock.d200 ? '$'+chartStock.d200.toFixed(2) : '—', 'var(--txt2)'],
            ].map(([l,v,c]:any)=>(
              <div key={l} style={{ background:'var(--bg3)', padding:'8px 12px' }}>
                <div style={{ fontSize:'9px', color:'var(--txt3)', marginBottom:'2px', textTransform:'uppercase', letterSpacing:'.06em' }}>{l}</div>
                <div style={{ fontSize:'12px', fontWeight:600, color:c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const ROW_HOVER = { onMouseEnter:(e:any)=>e.currentTarget.style.background='rgba(255,255,255,.025)', onMouseLeave:(e:any)=>e.currentTarget.style.background='transparent' };

  // Sector strip component
  const SectorStrip = () => {
    const sectors = themeResp.sectors || [];
    if (!sectors.length) return null;
    return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(11,1fr)', gap:'6px', marginBottom:'12px' }}>
        {sectors.map(s => {
          const isPos = s.pct >= 0;
          const bg    = isPos ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)';
          const bdr   = isPos ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)';
          return (
            <div key={s.etf} style={{ background:bg, border:`1px solid ${bdr}`, borderRadius:'var(--r2)', padding:'8px 8px 7px', textAlign:'center' }}>
              <div style={{ fontSize:'10px', fontWeight:700, color:'var(--txt)', marginBottom:'1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
              <div style={{ fontSize:'9px', color:'var(--txt3)', marginBottom:'4px' }}>{s.etf}</div>
              <div style={{ fontSize:'12px', fontWeight:700, color:pctColor(s.pct) }}>{pct(s.pct)}</div>
              <div style={{ fontSize:'10px', color:'var(--txt3)', marginTop:'1px' }}>{fmt$(s.price)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <ChartModal/>
      <div style={{ display:'flex', borderBottom:'1px solid var(--brd)', marginBottom:'14px' }}>
        {(['gap','momentum','themes','fundamentals'] as const).map(t=>(
          <button key={t} onClick={()=>{ setTab(t); setDetail(null); }} style={{
            padding:'8px 14px', fontSize:'12px', fontWeight:600, cursor:'pointer',
            background:'none', border:'none', borderBottom: tab===t ? '2px solid var(--ac)' : '2px solid transparent',
            color: tab===t ? 'var(--ac2)' : 'var(--txt2)', fontFamily:'var(--sans)', transition:'.1s',
          }}>
            {t==='gap'?'Gap Scanner':t==='fundamentals'?'Fundamentals':t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── GAP SCANNER ── */}
      {tab==='gap' && (
        <div style={{ display:'grid', gridTemplateColumns:'155px 1fr', gap:'12px', flex:1 }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', padding:'11px', alignSelf:'start', position:'sticky', top:0, maxHeight:'calc(100vh - 120px)', overflowY:'auto' }}>
            <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--txt3)', marginBottom:'9px', paddingBottom:'7px', borderBottom:'1px solid var(--brd)' }}>Filters</div>
            <div style={GRP}><label style={LBL}>Direction</label>
              <select style={INPUT} value={gDir} onChange={e=>setGDir(e.target.value)}>
                <option value="both">Up + Down</option><option value="up">Gap Up only</option><option value="down">Gap Down only</option>
              </select>
            </div>
            {([
              ['Gap %','number',gGapMin,setGGapMin,gGapMax,setGGapMax],
              ['Price $','number',gPriceMin,setGPriceMin,gPriceMax,setGPriceMax],
              ['Pre-Mkt Vol (K)','number',gVolMin,setGVolMin,gVolMax,setGVolMax],
              ['Float (M)','number',gFloatMin,setGFloatMin,gFloatMax,setGFloatMax],
              ['ADR %','number',gAdrMin,setGAdrMin,gAdrMax,setGAdrMax],
              ['ATR','number',gAtrMin,setGAtrMin,gAtrMax,setGAtrMax],
            ] as any[]).map(([label,type,minV,minS,maxV,maxS])=>(
              <div key={label} style={GRP}><label style={LBL}>{label}</label>
                <div style={{display:'flex',gap:'4px'}}>
                  <input style={INPUT_HALF} type={type} value={minV||''} onChange={(e:any)=>minS(+e.target.value)} placeholder="Min"/>
                  <input style={INPUT_HALF} type={type} value={maxV||''} onChange={(e:any)=>maxS(+e.target.value)} placeholder="Max"/>
                </div>
              </div>
            ))}
            {([
              ['Avg Vol 30D',gAvgVolMin,setGAvgVolMin,gAvgVolMax,setGAvgVolMax],
              ['Dollar Vol',gDolVolMin,setGDolVolMin,gDolVolMax,setGDolVolMax],
              ['Mkt Cap',gMktCapMin,setGMktCapMin,gMktCapMax,setGMktCapMax],
            ] as any[]).map(([label,minV,minS,maxV,maxS])=>(
              <div key={label} style={GRP}><label style={LBL}>{label}</label>
                <div style={{display:'flex',gap:'4px'}}>
                  <input style={INPUT_HALF} type="text" value={minV} onChange={(e:any)=>minS(e.target.value)} placeholder="Min"/>
                  <input style={INPUT_HALF} type="text" value={maxV} onChange={(e:any)=>maxS(e.target.value)} placeholder="Max"/>
                </div>
              </div>
            ))}
            <div style={{ borderTop:'1px solid var(--brd)', marginTop:'8px', paddingTop:'8px' }}>
              <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--txt3)', marginBottom:'6px' }}>Saved Screens</div>
              <div style={{ display:'flex', gap:'4px', marginBottom:'6px' }}>
                <input style={{ ...INPUT, flex:1, fontSize:'9px', padding:'0 6px' }} type="text" value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="Screen name" onKeyDown={e=>e.key==='Enter'&&savePreset()}/>
                <button onClick={savePreset} style={{ height:'28px', padding:'0 7px', background:'var(--ac)', color:'#000', border:'none', borderRadius:'var(--r)', fontSize:'10px', fontWeight:700, cursor:'pointer', flexShrink:0 }}>Save</button>
              </div>
              {presets.length > 0 && (
                <div style={{ maxHeight:'100px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'2px' }}>
                  {presets.map(p=>(
                    <div key={p.name} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                      <button onClick={()=>loadPreset(p)} style={{ flex:1, height:'24px', background:'var(--bg4)', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt2)', fontSize:'10px', cursor:'pointer', textAlign:'left', padding:'0 6px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</button>
                      <button onClick={()=>deletePreset(p.name)} style={{ width:'24px', height:'24px', background:'none', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt3)', fontSize:'12px', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {presets.length===0 && <div style={{ fontSize:'10px', color:'var(--txt4)', textAlign:'center', padding:'4px 0' }}>No saved screens yet</div>}
            </div>
            <div style={{ display:'flex', gap:'4px', marginTop:'8px' }}>
              <button onClick={resetFilters} style={{ flex:1, height:'28px', background:'none', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt2)', fontSize:'11px', cursor:'pointer', fontFamily:'var(--sans)' }}>Reset</button>
              {SB_BTN(loading.gap?'Loading...':'Refresh',()=>load('gap',`${BASE}/gaps`,setGapData),loading.gap)}
            </div>
          </div>
          <div>
            {error.gap && <div style={{ marginBottom:'8px', padding:'9px 12px', background:'var(--red-d)', border:'1px solid rgba(239,68,68,.2)', borderRadius:'var(--r)', fontSize:'11px', color:'var(--red)' }}>{error.gap}</div>}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'7px' }}>
              <span style={{ fontSize:'11px', color:'var(--txt3)' }}>{loading.gap?'Loading live data...':`${filteredGaps.length} results · live`}</span>
              <button
                onClick={()=>{
                  const text = filteredGaps.map(r => r.ticker).join('\n');
                  navigator.clipboard.writeText(text).then(()=>alert(`${filteredGaps.length} tickers copied! Paste in TradingView watchlist.`));
                }}
                style={{ height:'26px', padding:'0 10px', background:'var(--bg4)', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt2)', fontSize:'10px', fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)', display:'flex', alignItems:'center', gap:'5px' }}
              >
                ↓ Export to TradingView
              </button>
            </div>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  {[['ticker','Ticker'],['gap','Gap %'],['preVol','Pre-Mkt Vol'],['prevClose','Prev Close'],['float','Float'],['adr','ADR %'],['atr','ATR'],['sector','Sector'],['industry','Industry'],['theme','Theme']].map(([col,label])=>(
                    <th key={col} style={TH} onClick={()=>{setGSortCol(col);setGSortAsc(a=>gSortCol===col?!a:false);}}>
                      {label}{gSortCol===col?(gSortAsc?' ↑':' ↓'):' ↕'}
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {loading.gap ? <tr><td colSpan={10} style={{ ...TD, textAlign:'center', color:'var(--txt3)', padding:'32px' }}>Fetching live data...</td></tr>
                  : filteredGaps.length===0 ? <tr><td colSpan={10} style={{ ...TD, textAlign:'center', color:'var(--txt3)', padding:'32px' }}>{gapData.length===0?'No pre-market gaps detected — Gap Scanner is live Monday–Friday 4:00 AM to 9:30 AM ET':'No results — adjust your filters'}</td></tr>
                  : filteredGaps.map(r=>(
                    <tr key={r.ticker} onClick={()=>setChartStock(r)} style={{ cursor:'pointer' }} {...ROW_HOVER}>
                      <td style={TD}><div style={{ fontWeight:600, color:'var(--ac2)', fontSize:'12px' }}>{r.ticker}</div><div style={{ fontSize:'10px', color:'var(--txt3)' }}>{r.name}</div></td>
                      <td style={{ ...TD, color:pctColor(r.gap), fontWeight:600 }}>{pct(r.gap)}</td>
                      <td style={{ ...TD, color:'var(--txt2)' }}>{r.preVol?r.preVol.toLocaleString()+'K':'—'}</td>
                      <td style={{ ...TD, fontFamily:'var(--mono)' }}>{fmt$(r.prevClose)}</td>
                      <td style={{ ...TD, color:'var(--txt2)' }}>{r.float?r.float+'M':'—'}</td>
                      <td style={{ ...TD, color:'var(--ac)', fontWeight:600 }}>{r.adr?r.adr.toFixed(1)+'%':'—'}</td>
                      <td style={{ ...TD, color:'var(--ac)', fontWeight:600 }}>{r.atr?r.atr.toFixed(1):'—'}</td>
                      <td style={{ ...TD, color:'var(--txt3)', fontSize:'10px' }}>{r.sector||'—'}</td>
                      <td style={{ ...TD, color:'var(--txt3)', fontSize:'10px' }}>{r.industry||'—'}</td>
                      <td style={{ ...TD, color:'var(--txt3)', fontSize:'10px' }}>{r.theme||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DetailPanel/>
          </div>
        </div>
      )}

      {/* ── MOMENTUM ── */}
      {tab==='momentum' && (
        <div style={{ display:'grid', gridTemplateColumns:'155px 1fr', gap:'12px', flex:1, minWidth:0 }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', padding:'11px', alignSelf:'start', position:'sticky', top:0, maxHeight:'calc(100vh - 120px)', overflowY:'auto' }}>
            <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--txt3)', marginBottom:'9px', paddingBottom:'7px', borderBottom:'1px solid var(--brd)' }}>Filters</div>
            {([['Min 1M %',mM1,setMM1],['Min 3M %',mM3,setMM3],['Min 6M %',mM6,setMM6],['Min ADR %',mAdr,setMAdr]] as any[]).map(([l,v,s])=>(
              <div key={l} style={GRP}><label style={LBL}>{l}</label><input style={INPUT} type="number" value={v} onChange={e=>s(e.target.value===''?'':+e.target.value)} placeholder="Min"/></div>
            ))}
            <div style={GRP}><label style={LBL}>ATR</label><input style={INPUT} type="number" value={mAtrMin} onChange={e=>setMAtrMin(e.target.value===''?'':+e.target.value)} placeholder="Min"/></div>
            {([['Min RS rank',mRs,setMRs],['Min EPS rank',mEps,setMEps],['Min Rev rank',mRev,setMRevR]] as any[]).map(([l,v,s])=>(
              <div key={l} style={GRP}><label style={LBL}>{l}</label><input style={INPUT} type="number" value={v} onChange={e=>s(e.target.value===''?'':+e.target.value)} placeholder="Min"/></div>
            ))}
            <div style={GRP}><label style={LBL}>Price $</label>
              <div style={{display:'flex',gap:'4px'}}><input style={INPUT_HALF} type="number" value={mPMin} onChange={e=>setMPMin(e.target.value===''?'':+e.target.value)} placeholder="Min"/><input style={INPUT_HALF} type="number" value={mPMax} onChange={e=>setMPMax(e.target.value===''?'':+e.target.value)} placeholder="Max"/></div>
            </div>
            <div style={GRP}><label style={LBL}>Avg Vol 30D</label>
              <div style={{display:'flex',gap:'4px'}}><input style={INPUT_HALF} type="text" value={mAvgVolMin} onChange={e=>setMAvgVolMin(e.target.value)} placeholder="Min"/><input style={INPUT_HALF} type="text" value={mAvgVolMax} onChange={e=>setMAvgVolMax(e.target.value)} placeholder="Max"/></div>
            </div>
            <div style={GRP}><label style={LBL}>Dollar Vol</label>
              <div style={{display:'flex',gap:'4px'}}><input style={INPUT_HALF} type="text" value={mDolVolMin} onChange={e=>setMDolVolMin(e.target.value)} placeholder="Min"/><input style={INPUT_HALF} type="text" value={mDolVolMax} onChange={e=>setMDolVolMax(e.target.value)} placeholder="Max"/></div>
            </div>
            <div style={GRP}><label style={LBL}>Mkt Cap</label>
              <div style={{display:'flex',gap:'4px'}}><input style={INPUT_HALF} type="text" value={mMktCapMin} onChange={e=>setMMktCapMin(e.target.value)} placeholder="Min"/><input style={INPUT_HALF} type="text" value={mMktCapMax} onChange={e=>setMMktCapMax(e.target.value)} placeholder="Max"/></div>
            </div>
            <div style={GRP}>
              <Toggle checked={mIncludeEtfs} onChange={setMIncludeEtfs} label="Include ETFs"/>
            </div>
            {/* ── Saved Screens ── */}
            <div style={{ borderTop:'1px solid var(--brd)', marginTop:'8px', paddingTop:'8px' }}>
              <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--txt3)', marginBottom:'6px' }}>Saved Screens</div>
              <div style={{ display:'flex', gap:'4px', marginBottom:'6px' }}>
                <input style={{ ...INPUT, flex:1, fontSize:'9px', padding:'0 6px' }} type="text" value={mPresetName} onChange={e=>setMPresetName(e.target.value)} placeholder="Screen name" onKeyDown={e=>e.key==='Enter'&&saveMPreset()}/>
                <button onClick={saveMPreset} style={{ height:'28px', padding:'0 7px', background:'var(--ac)', color:'#000', border:'none', borderRadius:'var(--r)', fontSize:'10px', fontWeight:700, cursor:'pointer', flexShrink:0 }}>Save</button>
              </div>
              {mPresets.length > 0 && (
                <div style={{ maxHeight:'100px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'2px' }}>
                  {mPresets.map(p=>(
                    <div key={p.name} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                      <button onClick={()=>loadMPreset(p)} style={{ flex:1, height:'24px', background:'var(--bg4)', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt2)', fontSize:'10px', cursor:'pointer', textAlign:'left', padding:'0 6px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</button>
                      <button onClick={()=>deleteMPreset(p.name)} style={{ width:'24px', height:'24px', background:'none', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt3)', fontSize:'12px', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {mPresets.length===0 && <div style={{ fontSize:'10px', color:'var(--txt4)', textAlign:'center', padding:'4px 0' }}>No saved screens yet</div>}
            </div>
            <div style={{ display:'flex', gap:'4px', marginTop:'8px' }}>
              <button onClick={resetMFilters} style={{ flex:1, height:'28px', background:'none', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt2)', fontSize:'11px', cursor:'pointer', fontFamily:'var(--sans)' }}>Reset</button>
              {SB_BTN(loading.mom?'Loading...':'Refresh',()=>load('mom',`${BASE}/momentum`,setMomData),loading.mom)}
            </div>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ marginBottom:'7px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'11px', color:'var(--txt3)' }}>{loading.mom?'Loading...':`${filteredMom.length} results · live`}</span>
              <button
                onClick={()=>{
                  const tickers = filteredMom.slice(0, 500).map(r => r.ticker).join('\n');
                  const blob = new Blob([tickers], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'sleektrade-momentum.txt';
                  a.click(); URL.revokeObjectURL(url);
                }}
                style={{ height:'26px', padding:'0 10px', background:'var(--bg4)', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt2)', fontSize:'10px', fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)', display:'flex', alignItems:'center', gap:'5px' }}
              >
                ↓ Export {Math.min(filteredMom.length, 500)} tickers
              </button>
            </div>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', width:'100%', overflowX:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
                <colgroup>
                  <col style={{width:'8%'}}/><col style={{width:'7%'}}/><col style={{width:'7%'}}/><col style={{width:'7%'}}/>
                  <col style={{width:'6%'}}/><col style={{width:'6%'}}/><col style={{width:'7%'}}/><col style={{width:'7%'}}/>
                  <col style={{width:'7%'}}/><col style={{width:'10%'}}/><col style={{width:'13%'}}/><col style={{width:'15%'}}/>
                </colgroup>
                <thead><tr>
                  {([['ticker','Ticker'],['m1','1M %'],['m3','3M %'],['m6','6M %'],['adr','ADR %'],['atr','ATR'],['rs','RS'],['epsRank','EPS'],['revRank','Rev'],['sector','Sector'],['industry','Industry'],['theme','Theme']] as [string,string][]).map(([col,label])=>(
                    <th key={col} style={{ ...TH, overflow:'hidden', textOverflow:'ellipsis' }} onClick={()=>handleMomSort(col)}>
                      {label}{momSortIcon(col)}
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {loading.mom ? <tr><td colSpan={12} style={{ ...TD, textAlign:'center', color:'var(--txt3)', padding:'32px' }}>Loading momentum data...</td></tr>
                  : filteredMom.map(r=>(
                    <tr key={r.ticker} onClick={()=>setChartStock(r)} style={{ cursor:'pointer' }} {...ROW_HOVER}>
                      <td style={{ ...TD, overflow:'hidden' }}><div style={{ fontWeight:600, color:'var(--ac2)', fontSize:'11px', overflow:'hidden', textOverflow:'ellipsis' }}>{r.ticker}</div><div style={{ fontSize:'9px', color:'var(--txt3)', overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</div></td>
                      <td style={{ ...TD, color:pctColor(r.m1), fontWeight:600 }}>{pct(r.m1)}</td>
                      <td style={{ ...TD, color:pctColor(r.m3), fontWeight:600 }}>{pct(r.m3)}</td>
                      <td style={{ ...TD, color:pctColor(r.m6), fontWeight:600 }}>{pct(r.m6)}</td>
                      <td style={{ ...TD, color:'var(--ac)', fontWeight:600 }}>{r.adr.toFixed(1)}%</td>
                      <td style={{ ...TD, color:'var(--ac)', fontWeight:600 }}>{r.atr!=null?r.atr.toFixed(2):'—'}</td>
                      <td style={TD}><RkBadge v={r.rs}/></td>
                      <td style={TD}><RkBadge v={r.epsRank}/></td>
                      <td style={TD}><RkBadge v={r.revRank}/></td>
                      <td style={{ ...TD, color:'var(--txt3)', fontSize:'10px', overflow:'hidden', textOverflow:'ellipsis' }}>{r.sector||'—'}</td>
                      <td style={{ ...TD, color:'var(--txt3)', fontSize:'10px', overflow:'hidden', textOverflow:'ellipsis' }}>{r.industry||'—'}</td>
                      <td style={{ ...TD, color:'var(--txt3)', fontSize:'10px', overflow:'hidden', textOverflow:'ellipsis' }}>{r.theme||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── THEMES ── */}
      {tab==='themes' && (
        <div style={{ display:'grid', gridTemplateColumns:'155px 1fr', gap:'12px', flex:1 }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', padding:'11px', alignSelf:'start' }}>
            <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--txt3)', marginBottom:'9px', paddingBottom:'7px', borderBottom:'1px solid var(--brd)' }}>Sort by</div>
            {(['today','1w','1m','3m','6m','ytd'] as const).map(p=>(
              <button key={p} onClick={()=>setThemeTime(p)} style={{ width:'100%', height:'27px', marginBottom:'4px', background:themeTime===p?'var(--ac)':'var(--bg4)', color:themeTime===p?'#000':'var(--txt2)', border:themeTime===p?'none':'1px solid var(--brd2)', borderRadius:'var(--r)', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)' }}>
                {p==='today'?'Today':p==='1w'?'1 Week':p==='1m'?'1 Month':p==='3m'?'3 Months':p==='6m'?'6 Months':'YTD'}
              </button>
            ))}
            <div style={{ marginTop:'10px', paddingTop:'9px', borderTop:'1px solid var(--brd)', fontSize:'10px', color:'var(--txt3)', lineHeight:1.6 }}>Click any theme to expand.</div>
          </div>
          <div>
            {error.themes && <div style={{ marginBottom:'8px', padding:'9px 12px', background:'var(--red-d)', border:'1px solid rgba(239,68,68,.2)', borderRadius:'var(--r)', fontSize:'11px', color:'var(--red)' }}>{error.themes}</div>}

            {/* Sector strip */}
            {loading.themes
              ? <div style={{ display:'grid', gridTemplateColumns:'repeat(11,1fr)', gap:'6px', marginBottom:'12px' }}>
                  {Array(11).fill(0).map((_,i)=><div key={i} style={{ height:'72px', background:'var(--bg3)', borderRadius:'var(--r2)', border:'1px solid var(--brd)' }}/>)}
                </div>
              : <SectorStrip/>
            }

            <div style={{ marginBottom:'7px' }}><span style={{ fontSize:'11px', color:'var(--txt3)' }}>{loading.themes?'Loading...':`${(themeResp.themes||[]).length} themes`}</span></div>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'160px 1fr 70px 70px 70px 70px 70px 70px', padding:'6px 12px', borderBottom:'2px solid var(--brd)', background:'var(--bg3)' }}>
                {['Theme','','1D%','1W%','1M%','3M%','6M%','YTD%'].map((h,i)=>(
                  <div key={i} style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--txt3)', textAlign:i>=2?'right':'left' }}>{h}</div>
                ))}
              </div>
              {loading.themes ? <div style={{ padding:'32px', textAlign:'center', color:'var(--txt3)', fontSize:'11px' }}>Loading theme data...</div>
              : (themeResp.themes||[]).map((d,i)=>{
                const maxAbs = Math.max(...(themeResp.themes||[]).map(t=>Math.abs(t.pct)));
                const barW   = maxAbs>0?Math.round((Math.abs(d.pct)/maxAbs)*44):0;
                const isPos  = d.pct>=0;
                return (
                  <div key={d.name}>
                    <div onClick={()=>setOpenTheme(openTheme===i?-1:i)}
                      style={{ display:'grid', gridTemplateColumns:'160px 1fr 70px 70px 70px 70px 70px 70px', alignItems:'center', padding:'5px 12px', borderBottom:'1px solid var(--brd)', cursor:'pointer', background:openTheme===i?'var(--bg3)':'transparent', transition:'.1s' }}
                      onMouseEnter={e=>{ if(openTheme!==i)(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.02)'; }}
                      onMouseLeave={e=>{ if(openTheme!==i)(e.currentTarget as HTMLElement).style.background='transparent'; }}>
                      <div>
                        <div style={{ fontSize:'11px', color:'var(--txt)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</div>
                        <div style={{ fontSize:'9px', color:'var(--txt3)' }}>{d.etf}</div>
                      </div>
                      <div style={{ position:'relative', height:'14px', display:'flex', alignItems:'center', marginRight:'8px' }}>
                        <div style={{ position:'absolute', left:'50%', width:'1px', height:'14px', background:'var(--brd2)' }}></div>
                        <div style={{ position:'absolute', height:'7px', borderRadius:'1px', ...(isPos?{left:'50%'}:{right:'50%'}), width:`${barW}%`, background:isPos?'var(--ac)':'var(--red)' }}></div>
                      </div>
                      <div style={{ fontSize:'11px', fontWeight:600, color:pctColor(d.pct1d), textAlign:'right' }}>{pct(d.pct1d)}</div>
                      <div style={{ fontSize:'11px', fontWeight:600, color:pctColor(d.pct1w), textAlign:'right' }}>{pct(d.pct1w)}</div>
                      <div style={{ fontSize:'11px', fontWeight:600, color:pctColor(d.pct1m), textAlign:'right' }}>{pct(d.pct1m)}</div>
                      <div style={{ fontSize:'11px', fontWeight:600, color:pctColor(d.pct3m), textAlign:'right' }}>{pct(d.pct3m)}</div>
                      <div style={{ fontSize:'11px', fontWeight:600, color:pctColor(d.pct6m), textAlign:'right' }}>{pct(d.pct6m)}</div>
                      <div style={{ fontSize:'11px', fontWeight:600, color:pctColor(d.pctYtd), textAlign:'right' }}>{pct(d.pctYtd)}</div>
                    </div>
                    {openTheme===i && (
                      <div style={{ background:'var(--bg)', borderBottom:'1px solid var(--brd)', padding:'8px 20px' }}>
                        {/* Theme ETF — clickable, visually marked as an ETF, sits above individual stocks */}
                        <div onClick={()=>setChartStock({ ticker:d.etf, name:`${d.name} (ETF)`, m1:null, m3:null, m6:d.pct6m, rs:null, epsRank:null, revRank:null, adr:null, d50:null, d200:null })}
                          style={{ display:'flex', alignItems:'center', padding:'6px 8px', marginBottom:'4px', borderRadius:'var(--r)', background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.3)', cursor:'pointer' }}
                          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(16,185,129,.14)'}
                          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='rgba(16,185,129,.08)'}>
                          <span style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.05em', color:'var(--ac)', background:'rgba(16,185,129,.18)', border:'1px solid rgba(16,185,129,.35)', borderRadius:'3px', padding:'1px 5px', marginRight:'8px', flexShrink:0 }}>ETF</span>
                            <span style={{ fontSize:'11px', fontWeight:700, color:'var(--ac2)', width:'48px', flexShrink:0 }}>{d.etf}</span>
                            <span style={{ fontSize:'10px', color:'var(--txt3)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', padding:'0 8px' }}>{d.name} sector ETF</span>
                            <span style={{ fontSize:'11px', fontWeight:600, color:pctColor(d.pct6m) }}>{pct(d.pct6m)} 6M</span>
                        </div>
                        {(d.stocks||[]).length>0?(d.stocks||[]).map((s:any)=>(
                          <div key={s.t} onClick={()=>setChartStock({ ticker:s.t, name:s.n, m1:null, m3:null, m6:parseFloat(s.p), rs:s.rs, epsRank:null, revRank:null, adr:null, d50:null, d200:null })}
                            style={{ display:'flex', alignItems:'center', padding:'5px 0', borderBottom:'1px solid var(--brd)', cursor:'pointer' }}
                            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.025)'}
                            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                            <span style={{ fontSize:'11px', fontWeight:600, color:'var(--ac2)', width:'48px', flexShrink:0 }}>{s.t}</span>
                            <span style={{ fontSize:'10px', color:'var(--txt3)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', padding:'0 8px' }}>{s.n}</span>
                            <div style={{ width:'28px', flexShrink:0, display:'flex', justifyContent:'center' }}><RkBadge v={s.rs}/></div>
                            <span style={{ fontSize:'11px', fontWeight:600, color:pctColor(parseFloat(s.p)), width:'70px', flexShrink:0, textAlign:'right' }}>{s.p} 6M</span>
                          </div>
                        )):(
                          <div style={{ fontSize:'10px', color:'var(--txt3)', padding:'4px 0' }}>ETF: {d.etf} · Sector: {d.sector}</div>
                        )}
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
      {tab==='fundamentals' && (
        <div style={{ display:'grid', gridTemplateColumns:'155px 1fr', gap:'12px', flex:1, minWidth:0 }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', padding:'11px', alignSelf:'start', position:'sticky', top:0, maxHeight:'calc(100vh - 120px)', overflowY:'auto' }}>
            <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--txt3)', marginBottom:'9px', paddingBottom:'7px', borderBottom:'1px solid var(--brd)' }}>Filters</div>
            {([
              ['EPS Rank (1-99)', fEpsRank, setFEpsRank],
              ['Rev Rank (1-99)', fRevRank, setFRevRank],
              ['RS Rank (1-99)',  fRs,      setFRs],
              ['Curr Q EPS Growth %', fEpsQ0Min, setFEpsQ0Min],
              ['Revenue Growth %',    fRevMin,   setFRevMin],
            ] as any[]).map(([l,v,s])=>(
              <div key={l} style={GRP}><label style={LBL}>{l}</label>
                <input style={INPUT} type="number" value={v} onChange={e=>s(e.target.value===''?'':+e.target.value)} placeholder="Min"/>
              </div>
            ))}
            <div style={GRP}><label style={LBL}>Industry</label>
              <input style={INPUT} type="text" value={fIndustry} onChange={e=>setFIndustry(e.target.value)} placeholder="e.g. Semiconductors"/>
            </div>
            <div style={GRP}><label style={LBL}>Sector</label>
              <input style={INPUT} type="text" value={fSector} onChange={e=>setFSector(e.target.value)} placeholder="e.g. Technology"/>
            </div>
            <div style={GRP}><label style={LBL}>Theme</label>
              <input style={INPUT} type="text" value={fTheme} onChange={e=>setFTheme(e.target.value)} placeholder="e.g. AI & Tech"/>
            </div>
            <div style={{ borderTop:'1px solid var(--brd)', marginTop:'8px', paddingTop:'8px' }}>
              <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--txt3)', marginBottom:'6px' }}>Saved Screens</div>
              <div style={{ display:'flex', gap:'4px', marginBottom:'6px' }}>
                <input style={{ ...INPUT, flex:1, fontSize:'9px', padding:'0 6px' }} type="text" value={fPresetName} onChange={e=>setFPresetName(e.target.value)} placeholder="Screen name" onKeyDown={e=>e.key==='Enter'&&saveFPreset()}/>
                <button onClick={saveFPreset} style={{ height:'28px', padding:'0 7px', background:'var(--ac)', color:'#000', border:'none', borderRadius:'var(--r)', fontSize:'10px', fontWeight:700, cursor:'pointer', flexShrink:0 }}>Save</button>
              </div>
              {fPresets.length > 0 && (
                <div style={{ maxHeight:'100px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'2px' }}>
                  {fPresets.map(p=>(
                    <div key={p.name} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                      <button onClick={()=>loadFPreset(p)} style={{ flex:1, height:'24px', background:'var(--bg4)', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt2)', fontSize:'10px', cursor:'pointer', textAlign:'left', padding:'0 6px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</button>
                      <button onClick={()=>deleteFPreset(p.name)} style={{ width:'24px', height:'24px', background:'none', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt3)', fontSize:'12px', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {fPresets.length===0 && <div style={{ fontSize:'10px', color:'var(--txt4)', textAlign:'center', padding:'4px 0' }}>No saved screens yet</div>}
            </div>
            <div style={{ display:'flex', gap:'4px', marginTop:'8px' }}>
              <button onClick={()=>{ setFEpsRank(''); setFRevRank(''); setFRs(''); setFEpsQ0Min(''); setFRevMin(''); setFIndustry(''); setFSector(''); setFTheme(''); }}
                style={{ flex:1, height:'28px', background:'none', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt2)', fontSize:'11px', cursor:'pointer', fontFamily:'var(--sans)' }}>Reset</button>
              {SB_BTN(loading.funda?'Loading...':'Refresh',()=>load('funda',`${BASE}/fundamentals`,setFundaData),loading.funda)}
            </div>
          </div>
          <div>
            <div style={{ marginBottom:'7px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'11px', color:'var(--txt3)' }}>{loading.funda?'Loading...':`${filteredFunda.length} results`}</span>
              <button
                onClick={()=>{
                  const text = filteredFunda.slice(0,500).map((r:any)=>r.ticker).join('\n');
                  const blob = new Blob([text], { type:'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href=url; a.download='sleektrade-fundamentals.txt'; a.click(); URL.revokeObjectURL(url);
                }}
                style={{ height:'26px', padding:'0 10px', background:'var(--bg4)', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt2)', fontSize:'10px', fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)' }}>
                ↓ Export {Math.min(filteredFunda.length,500)} tickers
              </button>
            </div>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', width:'100%', overflowX:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
                <colgroup>
                  <col style={{width:'8%'}}/>  {/* Ticker */}
                  <col style={{width:'6%'}}/>  {/* Price */}
                  <col style={{width:'8%'}}/>  {/* EPS Curr Q YoY */}
                  <col style={{width:'8%'}}/>  {/* EPS Prior Q YoY */}
                  <col style={{width:'8%'}}/>  {/* Annual EPS */}
                  <col style={{width:'9%'}}/>  {/* Rev Growth (Q YoY) */}
                  <col style={{width:'6%'}}/>  {/* EPS Rank */}
                  <col style={{width:'6%'}}/>  {/* Rev Rank */}
                  <col style={{width:'6%'}}/>  {/* RS Rank */}
                  <col style={{width:'12%'}}/> {/* Industry */}
                  <col style={{width:'11%'}}/> {/* Sector */}
                  <col style={{width:'12%'}}/> {/* Theme */}
                </colgroup>
                <thead><tr>
                  {([['ticker','Ticker'],['price','Price'],['epsQ0','EPS Curr Q YoY'],['epsQ1','EPS Prior Q YoY'],['epsAnn','Annual EPS'],['revGrowth','Rev Growth (Q YoY)'],['epsRank','EPS Rank'],['revRank','Rev Rank'],['rs','RS Rank'],['industry','Industry'],['sector','Sector'],['theme','Theme']] as [string,string][]).map(([col,label])=>(
                    <th key={col} style={TH} onClick={()=>handleFundaSort(col)}>{label}{fundaSortIcon(col)}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {loading.funda
                    ? <tr><td colSpan={12} style={{ ...TD, textAlign:'center', color:'var(--txt3)', padding:'32px' }}>Loading fundamentals...</td></tr>
                    : filteredFunda.length===0
                    ? <tr><td colSpan={12} style={{ ...TD, textAlign:'center', color:'var(--txt3)', padding:'32px' }}>No results — adjust filters</td></tr>
                    : filteredFunda.map((r:any)=>(
                      <tr key={r.ticker} onClick={()=>setChartStock(r)} style={{ cursor:'pointer' }} {...ROW_HOVER}>
                        <td style={{ ...TD, overflow:'hidden' }}><div style={{ fontWeight:600, color:'var(--ac2)', fontSize:'12px', overflow:'hidden', textOverflow:'ellipsis' }}>{r.ticker}</div></td>
                        <td style={{ ...TD, fontFamily:'var(--mono)' }}>{fmt$(r.price)}</td>
                        <td style={{ ...TD, color:pctColor(r.epsQ0), fontWeight:600 }}>{pct(r.epsQ0)}</td>
                        <td style={{ ...TD, color:pctColor(r.epsQ1), fontWeight:600 }}>{pct(r.epsQ1)}</td>
                        <td style={{ ...TD, color:pctColor(r.epsAnn), fontWeight:600 }}>{pct(r.epsAnn)}</td>
                        <td style={{ ...TD, color:pctColor(r.revGrowth), fontWeight:600 }}>{pct(r.revGrowth)}</td>
                        <td style={TD}><RkBadge v={r.epsRank}/></td>
                        <td style={TD}><RkBadge v={r.revRank}/></td>
                        <td style={TD}><RkBadge v={r.rs}/></td>
                        <td style={{ ...TD, color:'var(--txt3)', fontSize:'10px', overflow:'hidden', textOverflow:'ellipsis' }}>{r.industry||'—'}</td>
                        <td style={{ ...TD, color:'var(--txt3)', fontSize:'10px', overflow:'hidden', textOverflow:'ellipsis' }}>{r.sector||'—'}</td>
                        <td style={{ ...TD, color:'var(--txt3)', fontSize:'10px', overflow:'hidden', textOverflow:'ellipsis' }}>{r.theme||'—'}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
