/* --------- Simple Kc table (typical values for classroom use) --------- */
const KC = {
  rice:      { initial: 1.05, mid: 1.20, late: 0.95 },
  wheat:     { initial: 0.70, mid: 1.15, late: 0.35 },
  maize:     { initial: 0.70, mid: 1.20, late: 0.60 },
  cotton:    { initial: 0.65, mid: 1.15, late: 0.70 },
  groundnut: { initial: 0.70, mid: 1.10, late: 0.60 },
  sugarcane: { initial: 0.45, mid: 1.25, late: 0.85 },
  tomato:    { initial: 0.60, mid: 1.15, late: 0.80 },
};
/* Field capacity (% vol) by soil type – rough classroom presets */
const FC = { sandy: 12, loam: 25, clay: 35 };

/* DOM helpers */
const $ = (id) => document.getElementById(id);
const nf = (x, d=2) => isFinite(x) ? Number(x).toFixed(d) : '–';

function readInputs(){
  return {
    crop: $('crop').value,
    stage: $('stage').value,
    areaHa: parseFloat($('area').value),
    et0: parseFloat($('et0').value),
    rain: parseFloat($('rain').value) || 0,
    soilPct: parseFloat($('soil').value) || 0,
    soilType: $('soilType').value,
    effPct: parseFloat($('eff').value) || 70,
  };
}

/* Core calculations */
function computePlan(inp){
  const kc = (KC[inp.crop] || {initial:0.7, mid:1.0, late:0.5})[inp.stage];
  const etc = (inp.et0 || 0) * kc; // mm/day

  const effRain = 0.8 * (inp.rain || 0);
  const fc = FC[inp.soilType] || 25;
  const rel = Math.min(1, Math.max(0, (inp.soilPct || 0) / fc));
  const soilCredit = rel * 0.6 * etc;

  const net = Math.max(0, etc - effRain - soilCredit);
  const eff = Math.min(0.99, Math.max(0.1, (inp.effPct||70)/100));
  const grossDepth = net / eff;

  const areaM2 = Math.max(0, (inp.areaHa||0) * 10000);
  const grossLitres = grossDepth * areaM2;

  let schedule, statusClass='good';
  if(grossLitres === 0){
    schedule = "No irrigation needed today. Recheck tomorrow.";
  }else if (grossDepth <= 5){
    schedule = "Light irrigation: apply once today.";
  }else if (grossDepth <= 15){
    schedule = "Moderate irrigation: split into 2 cycles (morning & evening).";
    statusClass='warn';
  }else{
    schedule = "Heavy requirement: split into 3 cycles and verify field drainage.";
    statusClass='bad';
  }

  return { kc, etc, effRain, soilCredit, net, grossDepth, grossLitres, eff, schedule, statusClass };
}

/* Chart */
function drawChart(etc, rain, soil, net){
  const ctx = $('chart').getContext('2d');
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);

  const labels = ['ETc', 'Eff. Rain', 'Soil Credit', 'Net Irrigation'];
  const vals = [etc, rain, soil, net].map(v=>Math.max(0,v));
  const maxV = Math.max(10, ...vals) * 1.25;
  const barW = (W-80)/labels.length;

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.moveTo(50,20); ctx.lineTo(50,H-30); ctx.lineTo(W-20,H-30); ctx.stroke();

  vals.forEach((v,i)=>{
    const x = 50 + i*barW + barW*0.2;
    const h = (v/maxV) * (H-60);
    const y = (H-30) - h;
    const g = ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,'#6cd1ff'); g.addColorStop(1,'#1c8bd6');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, barW*0.6, h);
    ctx.fillStyle = '#eaf2ff';
    ctx.font = '12px system-ui';
    ctx.fillText(${v.toFixed(1)} mm, x, y-6);
    ctx.fillStyle = '#9fb4d3';
    ctx.fillText(labels[i], x, H-12);
  });
}

/* Storage */
function loadRuns(){ try { return JSON.parse(localStorage.getItem('wm_runs')||'[]'); } catch(e){ return [] } }
function saveRuns(rows){ localStorage.setItem('wm_runs', JSON.stringify(rows)); }
function addRun(row){ const rows=loadRuns(); rows.unshift(row); saveRuns(rows); renderRuns(); }

function renderRuns(){
  const tb = $('runsTable').querySelector('tbody');
  tb.innerHTML='';
  loadRuns().forEach((r,idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.date}</td><td>${r.crop}</td><td>${r.stage}</td><td>${r.areaHa}</td>
      <td>${r.et0}</td><td>${r.rain}</td><td>${r.etc}</td><td>${r.grossL}</td>
      <td><button class="secondary" data-del="${idx}">Delete</button></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('button[data-del]').forEach(btn=>{
    btn.onclick = ()=>{ const rows=loadRuns(); rows.splice(parseInt(btn.dataset.del),1); saveRuns(rows); renderRuns(); };
  });
}

function exportCSV(){
  const rows = loadRuns();
  const header = ['Date','Crop','Stage','Area_ha','ET0_mm_day','Rain_mm','ETc_mm','Net_mm','