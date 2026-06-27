'use client';

import { useEffect, useState, useCallback } from 'react';

const BASE = '/api/scanner';

function pct(v: number | null) {
  if (v == null) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
}
function pctStyle(v: number | null): string {
  if (v == null) return 'var(--txt3)';
  return v > 0 ? 'var(--ac)' : v < 0 ? 'var(--red)' : 'var(--txt3)';
}
function fmt$(v: number | null) {
  return v == null ? '—' : '$' + v.toFixed(2);
}
function rkBadge(v: number | null) {
  if (v == null) return <span style={{ color: 'var(--txt3)' }}>—</span>;
  const bg = v >= 75
    ? 'rgba(16,185,129,.18)' : v >= 40
    ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.18)';
  const color = v >= 75 ? '#10B981' : v >= 40 ? '#F59E0B' : '#EF4444';
  const border = v >= 75
    ? 'rgba(16,185,129,.35)' : v >= 40
    ? 'rgba(245,158,11,.3)' : 'rgba(239,68,68,.35)';
  return (
    <span style={{ display:'inline-block', minWidth:'28px', textAlign:'center', padding:'2px 6px', borderRadius:'4px', fontSize:'10px', fontWeight:700, background:bg, color, border:`1px solid ${border}` }}>
      {v}
    </span>
  );
}

type GapStock   = { ticker:string; name:string; gap:number; prePrice:number; preVol:number; prevClose:number; float:number|null; adr:number; atr:number; sector:string|null; industry:string|null; isPreMarket:boolean; isPostMarket:boolean };
type MomStock   = { ticker:string; name:string; price:number; m1:number; m3:number; m6:number; adr:number; atrPct:number; rs:number; sector:string|null; d50:number|null; d200:number|null };
type Theme      = { name:string; pct:number; stocks:{t:string;n:string;p:string;pctVal:number}[] };
type FundaStock = { ticker:string; name:string; price:number; epsQoQ:number|null; epsYoY:number|null; revGrowth:number|null; epsRank:number|null; revRank:number|null; instRank:number|null; floatM:number|null; shortPct:number|null };

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', height: '30px', background: 'var(--bg4)',
  border: '1px solid var(--brd2)', borderRadius: 'var(--r)',
  color: 'var(--txt)', fontSize: '11px', padding: '0 8px',
  fontFamily: 'var(--sans)', outline: 'none',
};
const LABEL_STYLE: React.CSSProperties = {
  fontSize: '9px', fontWeight: 600, letterSpacing: '.06em',
  textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: '4px', display: 'block',
};
const GROUP_STYLE: React.CSSProperties = { marginBottom: '10px' };
const TH_STYLE: React.CSSProperties = {
  fontSize: '9px', fontWeight: 600, letterSpacing: '.06em',
  textTransform: 'uppercase', color: 'var(--txt3)',
  padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--brd)',
  whiteSpace: 'nowrap', cursor: 'pointer',
};
const TD_STYLE: React.CSSProperties = {
  padding: '8px 10px', fontSize: '11px',
  borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap',
};

export default function ScannerPage() {
  const [tab, setTab] = useState<'gap'|'momentum'|'themes'|'fundamentals'>('gap');
  const [gapData,   setGapData]   = useState<GapStock[]>([]);
  const [momData,   setMomData]   = useState<MomStock[]>([]);
  const [themeData, setThemeData] = useState<Theme[]>([]);
  const [fundaData, setFundaData] = useState<FundaStock[]>([]);
  const [loading,   setLoading]   = useState<Record<string,boolean>>({ gap:true, mom:true, themes:false, funda:false });
  const [error,     setError]     = useState<Record<string,string>>({});
  const [themeTime, setThemeTime] = useState<'today'|'1w'|'1m'|'ytd'>('today');
  const [openTheme, setOpenTheme] = useState(-1);
  const [detail,    setDetail]    = useState<any>(null);
  const [detailType,setDetailType]= useState('');
  const [currentTicker, setCurrentTicker] = useState('');
  const [clock, setClock] = useState('');
  const [themeLoaded,setThemeLoaded] = useState(false);
  const [fundaLoaded,setFundaLoaded] = useState(false);

  // Gap filters
  const [gDir,   setGDir]   = useState('both');
  const [gMin,   setGMin]   = useState(1);
  const [gMax,   setGMax]   = useState(50);
  const [gPMin,  setGPMin]  = useState(5);
  const [gPMax,  setGPMax]  = useState(1000);
  const [gVol,   setGVol]   = useState(0);
  const [gFloat, setGFloat] = useState(500);
  const [gAdr,   setGAdr]   = useState(0);

  // Momentum filters
  const [mM1,  setMM1]  = useState(-100);
  const [mM3,  setMM3]  = useState(-100);
  const [mM6,  setMM6]  = useState(-100);
  const [mAdr, setMAdr] = useState(0);
  const [mPMin,setMPMin]= useState(5);
  const [mPMax,setMPMax]= useState(5000);
  const [mRs,  setMRs]  = useState(1);

  // Funda filters
  const [fEps,   setFEps]   = useState(1);
  const [fRev,   setFRev]   = useState(1);
  const [fInst,  setFInst]  = useState(1);
  const [fFloat, setFFloat] = useState(1000);
  const [fShort, setFShort] = useState(0);

  useEffect(() => {
    const update = () => {
      const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const h = et.getHours(), m = et.getMinutes();
      const status = h < 4 ? 'Closed' : (h < 9 || (h===9&&m<30)) ? 'Pre-Market' : h < 16 ? 'Market Open' : 'After Hours';
      const color = status==='Market Open' ? 'var(--ac)' : status==='Pre-Market' ? 'var(--orange)' : 'var(--txt3)';
      setClock(`${et.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})} ET — <span style="color:${color}">${status}</span>`);
    };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, []);

  const loadGaps = useCallback(async () => {
    setLoading(l => ({...l,gap:true})); setError(e => ({...e,gap:''}));
    try {
      const res = await fetch(`${BASE}/gaps`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGapData(data);
    } catch(e:any) { setError(err => ({...err,gap:e.message})); }
    finally { setLoading(l => ({...l,gap:false})); }
  }, []);

  const loadMom = useCallback(async () => {
    setLoading(l => ({...l,mom:true}));
    try {
      const res = await fetch(`${BASE}/momentum`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMomData(data);
    } catch(e:any) { setError(err => ({...err,mom:e.message})); }
    finally { setLoading(l => ({...l,mom:false})); }
  }, []);

  const loadThemes = useCallback(async (period: string) => {
    setLoading(l => ({...l,themes:true})); setError(e => ({...e,themes:''}));
    try {
      const res = await fetch(`${BASE}/themes?period=${period}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setThemeData(data); setOpenTheme(-1);
    } catch(e:any) { setError(err => ({...err,themes:e.message})); }
    finally { setLoading(l => ({...l,themes:false})); }
  }, []);

  const loadFunda = useCallback(async () => {
    setLoading(l => ({...l,funda:true}));
    try {
      const res = await fetch(`${BASE}/fundamentals`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFundaData(data);
    } catch(e:any) { setError(err => ({...err,funda:e.message})); }
    finally { setLoading(l => ({...l,funda:false})); }
  }, []);

  useEffect(() => { loadGaps(); loadMom(); }, []);
  useEffect(() => { if (tab==='themes' && !themeLoaded) { setThemeLoaded(true); loadThemes(themeTime); } }, [tab]);
  useEffect(() => { if (tab==='fundamentals' && !fundaLoaded) { setFundaLoaded(true); loadFunda(); } }, [tab]);
  useEffect(() => { if (themeLoaded) loadThemes(themeTime); }, [themeTime]);

  const filteredGaps = gapData.filter(r => {
    if (gDir==='up' && r.gap<0) return false;
    if (gDir==='down' && r.gap>0) return false;
    if (Math.abs(r.gap)<gMin || Math.abs(r.gap)>gMax) return false;
    if (r.prePrice<gPMin || r.prePrice>gPMax) return false;
    if ((r.preVol||0)<gVol) return false;
    if (r.float && r.float>gFloat) return false;
    if (r.adr<gAdr) return false;
    return true;
  }).sort((a,b) => Math.abs(b.gap)-Math.abs(a.gap));

  const filteredMom = momData
    .filter(r => r.m1>=mM1 && r.m3>=mM3 && r.m6>=mM6 && r.adr>=mAdr && r.price>=mPMin && r.price<=mPMax && r.rs>=mRs)
    .sort((a,b) => b.rs-a.rs);

  const filteredFunda = fundaData
    .filter(r => (r.epsRank||0)>=fEps && (r.revRank||0)>=fRev && (r.instRank||0)>=fInst && (!r.floatM||r.floatM<=fFloat) && (!r.shortPct||r.shortPct>=fShort));

  const sidebar = (
    <div style={{ width:'160px', flexShrink:0, background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', padding:'12px', alignSelf:'start' }}>
      <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--txt3)', marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px solid var(--brd)' }}>Filters</div>
      {tab==='gap' && <>
        <div style={GROUP_STYLE}><label style={LABEL_STYLE}>Direction</label>
          <select style={INPUT_STYLE} value={gDir} onChange={e=>setGDir(e.target.value)}>
            <option value="both">Up + Down</option><option value="up">Gap Up only</option><option value="down">Gap Down only</option>
          </select>
        </div>
        <div style={GROUP_STYLE}><label style={LABEL_STYLE}>Gap %</label>
          <div style={{display:'flex',gap:'4px'}}>
            <input style={INPUT_STYLE} type="number" value={gMin} onChange={e=>setGMin(+e.target.value)} placeholder="Min"/>
            <input style={INPUT_STYLE} type="number" value={gMax} onChange={e=>setGMax(+e.target.value)} placeholder="Max"/>
          </div>
        </div>
        <div style={GROUP_STYLE}><label style={LABEL_STYLE}>Price $</label>
          <div style={{display:'flex',gap:'4px'}}>
            <input style={INPUT_STYLE} type="number" value={gPMin} onChange={e=>setGPMin(+e.target.value)} placeholder="Min"/>
            <input style={INPUT_STYLE} type="number" value={gPMax} onChange={e=>setGPMax(+e.target.value)} placeholder="Max"/>
          </div>
        </div>
        <div style={GROUP_STYLE}><label style={LABEL_STYLE}>Min vol K</label><input style={INPUT_STYLE} type="number" value={gVol} onChange={e=>setGVol(+e.target.value)}/></div>
        <div style={GROUP_STYLE}><label style={LABEL_STYLE}>Max float M</label><input style={INPUT_STYLE} type="number" value={gFloat} onChange={e=>setGFloat(+e.target.value)}/></div>
        <div style={GROUP_STYLE}><label style={LABEL_STYLE}>Min ADR %</label><input style={INPUT_STYLE} type="number" value={gAdr} onChange={e=>setGAdr(+e.target.value)}/></div>
        <button onClick={loadGaps} style={{ width:'100%', height:'30px', background:'var(--ac)', color:'#000', border:'none', borderRadius:'var(--r)', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'var(--sans)' }}>
          {loading.gap ? 'Loading...' : 'Refresh'}
        </button>
      </>}
      {tab==='momentum' && <>
        {[['Min 1M %',mM1,setMM1],['Min 3M %',mM3,setMM3],['Min 6M %',mM6,setMM6],['Min ADR %',mAdr,setMAdr],['Min RS rank',mRs,setMRs]].map(([l,v,s]:any)=>(
          <div key={l} style={GROUP_STYLE}><label style={LABEL_STYLE}>{l}</label><input style={INPUT_STYLE} type="number" value={v} onChange={e=>s(+e.target.value)}/></div>
        ))}
        <div style={GROUP_STYLE}><label style={LABEL_STYLE}>Price $</label>
          <div style={{display:'flex',gap:'4px'}}>
            <input style={INPUT_STYLE} type="number" value={mPMin} onChange={e=>setMPMin(+e.target.value)} placeholder="Min"/>
            <input style={INPUT_STYLE} type="number" value={mPMax} onChange={e=>setMPMax(+e.target.value)} placeholder="Max"/>
          </div>
        </div>
        <button onClick={loadMom} style={{ width:'100%', height:'30px', background:'var(--ac)', color:'#000', border:'none', borderRadius:'var(--r)', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'var(--sans)' }}>
          {loading.mom ? 'Loading...' : 'Refresh'}
        </button>
      </>}
      {tab==='themes' && <>
        <div style={{ fontSize:'9px', color:'var(--txt3)', marginBottom:'8px' }}>Time period</div>
        {(['today','1w','1m','ytd'] as const).map(p => (
          <button key={p} onClick={()=>setThemeTime(p)} style={{ width:'100%', height:'28px', marginBottom:'4px', background: themeTime===p ? 'var(--ac)' : 'var(--bg4)', color: themeTime===p ? '#000' : 'var(--txt2)', border: themeTime===p ? 'none' : '1px solid var(--brd2)', borderRadius:'var(--r)', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'var(--sans)' }}>
            {p==='today'?'Today':p==='1w'?'1 week':p==='1m'?'1 month':'YTD'}
          </button>
        ))}
        <div style={{ marginTop:'12px', paddingTop:'10px', borderTop:'1px solid var(--brd)', fontSize:'10px', color:'var(--txt3)', lineHeight:1.6 }}>Click any theme to expand and see top stocks.</div>
      </>}
      {tab==='fundamentals' && <>
        {[['Min EPS rank',fEps,setFEps],['Min rev rank',fRev,setFRev],['Min inst rank',fInst,setFInst],['Max float M',fFloat,setFFloat],['Min short %',fShort,setFShort]].map(([l,v,s]:any)=>(
          <div key={l} style={GROUP_STYLE}><label style={LABEL_STYLE}>{l}</label><input style={INPUT_STYLE} type="number" value={v} onChange={e=>s(+e.target.value)}/></div>
        ))}
        <button onClick={loadFunda} style={{ width:'100%', height:'30px', background:'var(--ac)', color:'#000', border:'none', borderRadius:'var(--r)', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'var(--sans)' }}>
          {loading.funda ? 'Loading...' : 'Refresh'}
        </button>
      </>}
    </div>
  );

  const detailPanel = detail && (
    <div style={{ marginTop:'12px', background:'var(--bg3)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', padding:'16px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'14px', paddingBottom:'12px', borderBottom:'1px solid var(--brd)' }}>
        <div>
          <div style={{ fontSize:'20px', fontWeight:700, color:'var(--txt)' }}>{detail.ticker}</div>
          <div style={{ fontSize:'11px', color:'var(--txt3)', marginTop:'2px' }}>{detail.name}</div>
        </div>
        <div style={{ display:'flex', alignItems:'flex-start', gap:'12px' }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'18px', fontWeight:700, color:'var(--txt)' }}>{fmt$(detail.prePrice || detail.price)}</div>
            <div style={{ fontSize:'11px', marginTop:'2px', color: pctStyle(detail.gap ?? detail.m6) }}>{pct(detail.gap ?? detail.m6)}</div>
          </div>
          <button onClick={()=>setDetail(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt3)', fontSize:'18px', lineHeight:1 }}>×</button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'14px' }}>
        {(detailType==='gap' ? [
          ['Gap %', <span style={{color:pctStyle(detail.gap)}}>{pct(detail.gap)}</span>],
          ['Prev close', fmt$(detail.prevClose)],
          ['Pre-mkt vol', detail.preVol ? detail.preVol.toLocaleString()+'K' : '—'],
          ['Float', detail.float ? detail.float+'M' : '—'],
          ['ADR %', detail.adr ? detail.adr.toFixed(1)+'%' : '—'],
          ['ATR %', detail.atr ? detail.atr.toFixed(1)+'%' : '—'],
          ['Sector', detail.sector||'—'],
          ['Industry', detail.industry||'—'],
        ] : detailType==='mom' ? [
          ['1M perf', <span style={{color:pctStyle(detail.m1)}}>{pct(detail.m1)}</span>],
          ['3M perf', <span style={{color:pctStyle(detail.m3)}}>{pct(detail.m3)}</span>],
          ['6M perf', <span style={{color:pctStyle(detail.m6)}}>{pct(detail.m6)}</span>],
          ['ADR %', detail.adr.toFixed(1)+'%'],
          ['ATR %', detail.atrPct.toFixed(1)+'%'],
          ['RS rank', rkBadge(detail.rs)],
          ['50D MA', fmt$(detail.d50)],
          ['200D MA', fmt$(detail.d200)],
        ] : [
          ['EPS QoQ', <span style={{color:pctStyle(detail.epsQoQ)}}>{pct(detail.epsQoQ)}</span>],
          ['EPS YoY', <span style={{color:pctStyle(detail.epsYoY)}}>{pct(detail.epsYoY)}</span>],
          ['Rev growth', <span style={{color:pctStyle(detail.revGrowth)}}>{pct(detail.revGrowth)}</span>],
          ['EPS rank', rkBadge(detail.epsRank)],
          ['Rev rank', rkBadge(detail.revRank)],
          ['Inst rank', rkBadge(detail.instRank)],
          ['Float', detail.floatM ? detail.floatM+'M' : '—'],
          ['Short %', detail.shortPct != null ? detail.shortPct.toFixed(1)+'%' : '—'],
        ]).map(([l,v]:any) => (
          <div key={l} style={{ background:'var(--bg4)', borderRadius:'var(--r)', padding:'8px 10px' }}>
            <div style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--txt3)', marginBottom:'4px' }}>{l}</div>
            <div style={{ fontSize:'13px', fontWeight:600, color:'var(--txt)' }}>{v}</div>
          </div>
        ))}
      </div>
      <a href={`https://www.tradingview.com/chart/?symbol=${currentTicker}`} target="_blank" rel="noreferrer"
        style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'7px 14px', background:'transparent', border:'1px solid var(--brd2)', borderRadius:'var(--r)', color:'var(--txt2)', fontSize:'11px', fontWeight:600, textDecoration:'none', cursor:'pointer', fontFamily:'var(--sans)' }}>
        Open on TradingView →
      </a>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--txt)', fontFamily:'var(--sans)' }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', height:'48px', borderBottom:'1px solid var(--brd)', background:'var(--bg2)' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'var(--txt)' }}>Scanner</div>
        <div style={{ display:'flex', alignItems:'center', gap:'16px', fontSize:'11px', color:'var(--txt3)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--ac)', display:'inline-block' }}></span>
            Live data
          </span>
          <span dangerouslySetInnerHTML={{ __html: clock }} />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--brd)', background:'var(--bg2)', padding:'0 20px' }}>
        {(['gap','momentum','themes','fundamentals'] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'10px 16px', fontSize:'12px', fontWeight:600,
            cursor:'pointer', background:'none', border:'none',
            borderBottom: tab===t ? '2px solid var(--ac)' : '2px solid transparent',
            color: tab===t ? 'var(--ac2)' : 'var(--txt2)',
            fontFamily:'var(--sans)', transition:'.1s',
          }}>
            {t==='gap'?'Gap scanner':t==='fundamentals'?'Fundamentals':t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding:'16px 20px' }}>

        {/* ── GAP SCANNER ── */}
        {tab==='gap' && (
          <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:'14px' }}>
            {sidebar}
            <div>
              {error.gap && <div style={{ marginBottom:'10px', padding:'10px 14px', background:'var(--red-d)', border:'1px solid rgba(239,68,68,.2)', borderRadius:'var(--r)', fontSize:'11px', color:'var(--red)' }}>{error.gap}</div>}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <span style={{ fontSize:'11px', color:'var(--txt3)' }}>{loading.gap ? 'Loading live data...' : `${filteredGaps.length} results · live data`}</span>
                <span style={{ fontSize:'10px', color:'var(--txt4)' }}>click row to expand</span>
              </div>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', overflow:'hidden' }}>
                <table className="tbl" style={{ width:'100%' }}>
                  <thead><tr>
                    {['Ticker','Gap %','Pre px','Vol K','Prev close','Float','ADR %','Sector'].map(h=>(
                      <th key={h} style={TH_STYLE}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {loading.gap ? (
                      <tr><td colSpan={8} style={{ ...TD_STYLE, textAlign:'center', color:'var(--txt3)', padding:'32px' }}>Fetching live data from Yahoo Finance...</td></tr>
                    ) : filteredGaps.length===0 ? (
                      <tr><td colSpan={8} style={{ ...TD_STYLE, textAlign:'center', color:'var(--txt3)', padding:'32px' }}>No results — adjust your filters</td></tr>
                    ) : filteredGaps.map(r => (
                      <tr key={r.ticker} onClick={()=>{ setDetail(r); setDetailType('gap'); setCurrentTicker(r.ticker); }}
                        style={{ cursor:'pointer', transition:'.1s' }}
                        onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,.02)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                        <td style={TD_STYLE}><div style={{ fontWeight:600, color:'var(--ac2)', fontSize:'12px' }}>{r.ticker}</div><div style={{ fontSize:'10px', color:'var(--txt3)' }}>{r.name}</div></td>
                        <td style={{ ...TD_STYLE, color:pctStyle(r.gap), fontWeight:600 }}>{pct(r.gap)}</td>
                        <td style={{ ...TD_STYLE, fontFamily:'var(--mono)' }}>{fmt$(r.prePrice)}</td>
                        <td style={{ ...TD_STYLE, color:'var(--txt2)' }}>{r.preVol ? r.preVol.toLocaleString()+'K' : '—'}</td>
                        <td style={{ ...TD_STYLE, fontFamily:'var(--mono)' }}>{fmt$(r.prevClose)}</td>
                        <td style={{ ...TD_STYLE, color:'var(--txt2)' }}>{r.float ? r.float+'M' : '—'}</td>
                        <td style={{ ...TD_STYLE, color:'var(--ac)', fontWeight:600 }}>{r.adr ? r.adr.toFixed(1)+'%' : '—'}</td>
                        <td style={{ ...TD_STYLE, color:'var(--txt3)', fontSize:'10px' }}>{r.sector||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail && detailType==='gap' && detailPanel}
            </div>
          </div>
        )}

        {/* ── MOMENTUM ── */}
        {tab==='momentum' && (
          <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:'14px' }}>
            {sidebar}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <span style={{ fontSize:'11px', color:'var(--txt3)' }}>{loading.mom ? 'Loading...' : `${filteredMom.length} results · live data`}</span>
              </div>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', overflow:'hidden' }}>
                <table className="tbl" style={{ width:'100%' }}>
                  <thead><tr>
                    {['Ticker','1M %','3M %','6M %','ADR %','ATR %','RS rank','Sector'].map(h=>(
                      <th key={h} style={TH_STYLE}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {loading.mom ? <tr><td colSpan={8} style={{ ...TD_STYLE, textAlign:'center', color:'var(--txt3)', padding:'32px' }}>Loading momentum data...</td></tr>
                    : filteredMom.map(r=>(
                      <tr key={r.ticker} onClick={()=>{ setDetail(r); setDetailType('mom'); setCurrentTicker(r.ticker); }}
                        style={{ cursor:'pointer' }}
                        onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,.02)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                        <td style={TD_STYLE}><div style={{ fontWeight:600, color:'var(--ac2)', fontSize:'12px' }}>{r.ticker}</div><div style={{ fontSize:'10px', color:'var(--txt3)' }}>{r.name}</div></td>
                        <td style={{ ...TD_STYLE, color:pctStyle(r.m1), fontWeight:600 }}>{pct(r.m1)}</td>
                        <td style={{ ...TD_STYLE, color:pctStyle(r.m3), fontWeight:600 }}>{pct(r.m3)}</td>
                        <td style={{ ...TD_STYLE, color:pctStyle(r.m6), fontWeight:600 }}>{pct(r.m6)}</td>
                        <td style={{ ...TD_STYLE, color:'var(--ac)', fontWeight:600 }}>{r.adr.toFixed(1)}%</td>
                        <td style={{ ...TD_STYLE, color:'var(--ac)', fontWeight:600 }}>{r.atrPct.toFixed(1)}%</td>
                        <td style={TD_STYLE}>{rkBadge(r.rs)}</td>
                        <td style={{ ...TD_STYLE, color:'var(--txt3)', fontSize:'10px' }}>{r.sector||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail && detailType==='mom' && detailPanel}
            </div>
          </div>
        )}

        {/* ── THEMES ── */}
        {tab==='themes' && (
          <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:'14px' }}>
            {sidebar}
            <div>
              {error.themes && <div style={{ marginBottom:'10px', padding:'10px 14px', background:'var(--red-d)', border:'1px solid rgba(239,68,68,.2)', borderRadius:'var(--r)', fontSize:'11px', color:'var(--red)' }}>{error.themes}</div>}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <span style={{ fontSize:'11px', color:'var(--txt3)' }}>{loading.themes ? 'Loading...' : `${themeData.length} themes · sorted strongest → weakest`}</span>
              </div>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', overflow:'hidden' }}>
                {loading.themes ? (
                  <div style={{ padding:'32px', textAlign:'center', color:'var(--txt3)', fontSize:'11px' }}>Loading theme data...</div>
                ) : themeData.map((d,i) => {
                  const maxAbs = Math.max(...themeData.map(t=>Math.abs(t.pct)));
                  const barW = Math.round((Math.abs(d.pct)/maxAbs)*44);
                  const isPos = d.pct >= 0;
                  return (
                    <div key={d.name}>
                      <div onClick={()=>setOpenTheme(openTheme===i?-1:i)}
                        style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 12px', borderBottom:'1px solid var(--brd)', cursor:'pointer', background: openTheme===i ? 'var(--bg3)' : 'transparent', transition:'.1s' }}
                        onMouseEnter={e=>{ if(openTheme!==i) e.currentTarget.style.background='rgba(255,255,255,.02)'; }}
                        onMouseLeave={e=>{ if(openTheme!==i) e.currentTarget.style.background='transparent'; }}>
                        <span style={{ fontSize:'12px', color:'var(--txt)', width:'160px', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                        <div style={{ flex:1, position:'relative', height:'16px', display:'flex', alignItems:'center' }}>
                          <div style={{ position:'absolute', left:'50%', width:'1px', height:'16px', background:'var(--brd2)' }}></div>
                          <div style={{ position:'absolute', height:'8px', borderRadius:'1px', [isPos?'left':'right']:'50%', width:`${barW}%`, background: isPos ? 'var(--ac)' : 'var(--red)' }}></div>
                        </div>
                        <span style={{ fontSize:'12px', fontWeight:600, width:'56px', textAlign:'right', flexShrink:0, color:pctStyle(d.pct) }}>{pct(d.pct)}</span>
                        <span style={{ color:'var(--txt3)', fontSize:'11px', flexShrink:0 }}>{openTheme===i?'▲':'▼'}</span>
                      </div>
                      {openTheme===i && (
                        <div style={{ background:'var(--bg)', borderBottom:'1px solid var(--brd)' }}>
                          {(d.stocks||[]).map(s=>(
                            <div key={s.t} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 24px', borderBottom:'1px solid var(--brd)' }}>
                              <span style={{ fontSize:'11px', fontWeight:600, color:'var(--ac2)', width:'50px' }}>{s.t}</span>
                              <span style={{ fontSize:'10px', color:'var(--txt3)', flex:1, padding:'0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.n}</span>
                              <span style={{ fontSize:'11px', fontWeight:600, color:pctStyle(parseFloat(s.p)) }}>{s.p}</span>
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
        {tab==='fundamentals' && (
          <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:'14px' }}>
            {sidebar}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <span style={{ fontSize:'11px', color:'var(--txt3)' }}>{loading.funda ? 'Loading fundamentals (20-30 sec)...' : `${filteredFunda.length} results · live data`}</span>
              </div>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r2)', overflow:'auto' }}>
                <table className="tbl" style={{ width:'100%' }}>
                  <thead><tr>
                    {['Ticker','Price','EPS QoQ','EPS YoY','Rev growth','EPS rank','Rev rank','Inst rank','Float','Short %'].map(h=>(
                      <th key={h} style={TH_STYLE}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {loading.funda ? <tr><td colSpan={10} style={{ ...TD_STYLE, textAlign:'center', color:'var(--txt3)', padding:'32px' }}>Loading fundamentals... (may take 20-30 seconds)</td></tr>
                    : filteredFunda.map(r=>(
                      <tr key={r.ticker} onClick={()=>{ setDetail(r); setDetailType('funda'); setCurrentTicker(r.ticker); }}
                        style={{ cursor:'pointer' }}
                        onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,.02)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                        <td style={TD_STYLE}><div style={{ fontWeight:600, color:'var(--ac2)', fontSize:'12px' }}>{r.ticker}</div><div style={{ fontSize:'10px', color:'var(--txt3)' }}>{r.name}</div></td>
                        <td style={{ ...TD_STYLE, fontFamily:'var(--mono)' }}>{fmt$(r.price)}</td>
                        <td style={{ ...TD_STYLE, color:pctStyle(r.epsQoQ), fontWeight:600 }}>{pct(r.epsQoQ)}</td>
                        <td style={{ ...TD_STYLE, color:pctStyle(r.epsYoY), fontWeight:600 }}>{pct(r.epsYoY)}</td>
                        <td style={{ ...TD_STYLE, color:pctStyle(r.revGrowth), fontWeight:600 }}>{pct(r.revGrowth)}</td>
                        <td style={TD_STYLE}>{rkBadge(r.epsRank)}</td>
                        <td style={TD_STYLE}>{rkBadge(r.revRank)}</td>
                        <td style={TD_STYLE}>{rkBadge(r.instRank)}</td>
                        <td style={{ ...TD_STYLE, color:'var(--txt2)' }}>{r.floatM ? r.floatM+'M' : '—'}</td>
                        <td style={{ ...TD_STYLE, color: r.shortPct&&r.shortPct>10 ? 'var(--orange)' : 'var(--txt2)', fontWeight: r.shortPct&&r.shortPct>10 ? 600 : 400 }}>{r.shortPct!=null ? r.shortPct.toFixed(1)+'%' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail && detailType==='funda' && detailPanel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
