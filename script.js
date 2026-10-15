"use strict";

const STARTING_STACK=1000, SMALL_BLIND=10, BIG_BLIND=20, STUD_ANTE=5, STUD_BRINGIN=10;
const CATS=['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'];
const RANK_LABEL={11:'J',12:'Q',13:'K',14:'A'};
const SUIT_SYMBOL={s:'♠',h:'♥',d:'♦',c:'♣'};
const SUIT_ORDER={c:0,d:1,h:2,s:3};
const DIFFICULTY={
  easy:{noise:0.33,aggression:0.12,bluffRate:0.02},
  medium:{noise:0.16,aggression:0.26,bluffRate:0.06},
  hard:{noise:0.06,aggression:0.40,bluffRate:0.13},
};
const HAND_EXAMPLES={
  'Straight Flush':'A♠ K♠ Q♠ J♠ T♠',
  'Four of a Kind':'9♠ 9♥ 9♦ 9♣ 2♣',
  'Full House':'K♠ K♥ K♦ 2♠ 2♥',
  'Flush':'A♥ J♥ 8♥ 5♥ 2♥',
  'Straight':'9♠ 8♥ 7♦ 6♣ 5♠',
  'Three of a Kind':'9♠ 9♥ 9♦ K♣ 2♠',
  'Two Pair':'9♠ 9♥ 5♦ 5♣ 2♠',
  'Pair':'9♠ 9♥ K♦ 7♣ 2♠',
  'High Card':'A♠ J♥ 8♦ 5♣ 2♠',
};

/* ---------- variants ---------- */
const VARIANTS={
  holdem:{
    id:'holdem', name:"Texas Hold'em", tagline:'2 cards + shared board', family:'community', holeCards:2,
    rulesHtml:`
      <h3>Texas Hold'em</h3>
      <p>The most widely played poker variant. Every player gets two private hole cards, and five community cards are dealt face up at the center of the table for everyone to share.</p>
      <ul>
        <li>Two hole cards are dealt to each player, then a round of betting.</li>
        <li>The <strong>flop</strong> deals three community cards, then a round of betting.</li>
        <li>The <strong>turn</strong> deals a fourth community card, then a round of betting.</li>
        <li>The <strong>river</strong> deals a fifth and final community card, then a last round of betting.</li>
        <li>At showdown, make the best 5-card hand from any combination of your 2 hole cards and the 5 community cards.</li>
      </ul>
      <p>A small blind and big blind force action before the first betting round.</p>`
  },
  omaha:{
    id:'omaha', name:'Omaha', tagline:'4 cards, use exactly 2', family:'community', holeCards:4,
    rulesHtml:`
      <h3>Omaha</h3>
      <p>Plays like Hold'em, but every player is dealt four hole cards instead of two, and the hand-building rule is stricter.</p>
      <ul>
        <li>Four hole cards are dealt to each player, then a round of betting.</li>
        <li>Flop, turn and river community cards are dealt exactly as in Hold'em, each followed by a betting round.</li>
        <li>At showdown you must use <strong>exactly two</strong> of your hole cards and <strong>exactly three</strong> community cards — never more, never fewer.</li>
      </ul>
      <p>With four hole cards to combine, made hands run bigger on average than in Hold'em, so strong-looking boards are more dangerous.</p>`
  },
  stud:{
    id:'stud', name:'Seven-Card Stud', tagline:'No community cards', family:'stud', holeCards:0,
    rulesHtml:`
      <h3>Seven-Card Stud</h3>
      <p>No community cards and no blinds. Every player antes a small amount before the deal, and cards come one at a time, some face down and some face up for the table to see.</p>
      <ul>
        <li><strong>Third street:</strong> each player gets two down cards and one up card. Whoever shows the lowest up-card must "bring in" — post a small forced bet to open the action.</li>
        <li><strong>Fourth, fifth and sixth street:</strong> one more up card each, with a betting round after every card.</li>
        <li><strong>Seventh street</strong> ("the river"): one final card, dealt face down.</li>
        <li>At showdown, make your best 5-card hand from any of your 7 cards — 3 down, 4 up.</li>
      </ul>`
  },
  draw:{
    id:'draw', name:'Five-Card Draw', tagline:'Discard and redraw once', family:'draw', holeCards:5,
    rulesHtml:`
      <h3>Five-Card Draw</h3>
      <p>The simplest classic variant — no community cards at all. Each player gets five private cards and a single chance to improve them.</p>
      <ul>
        <li>Five cards are dealt face down to each player. A small blind and big blind open the action.</li>
        <li>A round of betting follows the deal.</li>
        <li>Surviving players may then discard any number of cards and draw the same number of replacements from the deck — or stand pat and keep their hand.</li>
        <li>A second and final round of betting follows the draw.</li>
        <li>Best 5-card hand at showdown wins; no further cards are dealt.</li>
      </ul>`
  },
};
const VARIANT_ORDER=['holdem','omaha','stud','draw'];
let variant=VARIANTS.holdem;

function rankLabel(r){ return RANK_LABEL[r] || String(r); }
function isRedSuit(s){ return s==='h'||s==='d'; }
function nextIdx(i){ return (i+1)%4; }
function escapeHtml(s){ return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

/* ---------- sound engine (synthesized, no audio files needed) ---------- */
let audioCtx=null;
let soundEnabled=true;
try{ soundEnabled = localStorage.getItem('showdown_sound') !== 'off'; }catch(e){ /* ignore */ }
function ensureAudio(){
  if(audioCtx) { if(audioCtx.state==='suspended') audioCtx.resume(); return; }
  try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ audioCtx=null; }
}
function tone(freq, start, dur, type, peak){
  if(!soundEnabled || !audioCtx) return;
  const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
  osc.type=type||'sine'; osc.frequency.value=freq;
  osc.connect(gain); gain.connect(audioCtx.destination);
  const t0=audioCtx.currentTime+start;
  gain.gain.setValueAtTime(0.0001,t0);
  gain.gain.linearRampToValueAtTime(peak||0.18,t0+0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  osc.start(t0); osc.stop(t0+dur+0.03);
}
function playSound(name){
  if(!soundEnabled) return;
  ensureAudio();
  if(!audioCtx) return;
  switch(name){
    case 'deal': tone(1150,0,0.05,'sine',0.10); break;
    case 'check': tone(330,0,0.09,'sine',0.14); break;
    case 'bet': tone(720,0,0.045,'square',0.07); tone(520,0.045,0.06,'square',0.07); break;
    case 'fold': tone(170,0,0.18,'sine',0.13); tone(120,0.06,0.2,'sine',0.09); break;
    case 'win':
      [523.25,659.25,783.99,1046.50].forEach((f,i)=>tone(f,i*0.1,0.24,'triangle',0.18));
      break;
    case 'lose':
      [440,349.23,261.63].forEach((f,i)=>tone(f,i*0.15,0.32,'sawtooth',0.11));
      break;
  }
}
function setSoundEnabled(on){
  soundEnabled=on;
  try{ localStorage.setItem('showdown_sound', on ? 'on' : 'off'); }catch(e){ /* ignore */ }
  const btn=document.getElementById('soundToggle');
  if(btn) btn.textContent = on ? 'Sound: On' : 'Sound: Off';
}

/* ---------- victory / loss feedback ---------- */
function launchConfetti(){
  const canvas=document.getElementById('confettiCanvas');
  if(!canvas) return;
  const dpr=window.devicePixelRatio||1;
  canvas.width=window.innerWidth*dpr;
  canvas.height=window.innerHeight*dpr;
  canvas.style.width=window.innerWidth+'px';
  canvas.style.height=window.innerHeight+'px';
  canvas.hidden=false;
  const ctx=canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const colors=['#d6ad5f','#e9c87f','#f3efe2','#8fa89b'];
  const particles=Array.from({length:90}).map(()=>({
    x:Math.random()*window.innerWidth,
    y:-20-Math.random()*window.innerHeight*0.3,
    vx:(Math.random()-0.5)*3,
    vy:2+Math.random()*3,
    size:4+Math.random()*5,
    color:colors[Math.floor(Math.random()*colors.length)],
    rot:Math.random()*360,
    vrot:(Math.random()-0.5)*10,
  }));
  const start=performance.now();
  function frame(now){
    const elapsed=now-start;
    ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
    particles.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.rot+=p.vrot;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle=p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);
      ctx.restore();
    });
    if(elapsed<2400){ requestAnimationFrame(frame); }
    else { ctx.clearRect(0,0,window.innerWidth,window.innerHeight); canvas.hidden=true; }
  }
  requestAnimationFrame(frame);
}
function triggerResultFeedback(){
  const human=players[0];
  const humanWon=state.lastWinners.includes(0);
  if(humanWon){
    playSound('win');
    launchConfetti();
  } else if(human.revealed){
    playSound('lose');
    const seatEl=document.getElementById('seat0');
    if(seatEl){
      seatEl.classList.remove('lose-shake'); void seatEl.offsetWidth;
      seatEl.classList.add('lose-shake');
      setTimeout(()=>seatEl.classList.remove('lose-shake'), 420);
    }
    const flash=document.getElementById('screenFlash');
    if(flash){
      flash.classList.remove('active'); void flash.offsetWidth;
      flash.classList.add('active');
    }
  }
}

/* ---------- deck & hand evaluation ---------- */
function freshDeck(){
  const suits=['s','h','d','c'], deck=[];
  for(const s of suits) for(let r=2;r<=14;r++) deck.push({rank:r,suit:s});
  return deck;
}
function shuffledDeck(){
  const d=freshDeck();
  for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=d[i]; d[i]=d[j]; d[j]=t; }
  return d;
}
function evaluate5(cards){
  const ranks=cards.map(c=>c.rank).sort((a,b)=>b-a);
  const suits=cards.map(c=>c.suit);
  const isFlush=suits.every(s=>s===suits[0]);
  const uniqueRanks=[...new Set(ranks)];
  let straightHigh=null;
  if(uniqueRanks.length===5){
    if(uniqueRanks[0]-uniqueRanks[4]===4) straightHigh=uniqueRanks[0];
    else if(JSON.stringify(uniqueRanks)===JSON.stringify([14,5,4,3,2])) straightHigh=5;
  }
  const countMap={};
  ranks.forEach(r=>countMap[r]=(countMap[r]||0)+1);
  const groups=Object.entries(countMap).map(([r,c])=>({r:+r,c})).sort((a,b)=>b.c-a.c||b.r-a.r);

  if(straightHigh && isFlush) return [8, straightHigh];
  if(groups[0].c===4) return [7, groups[0].r, groups[1].r];
  if(groups[0].c===3 && groups[1].c===2) return [6, groups[0].r, groups[1].r];
  if(isFlush) return [5, ...ranks];
  if(straightHigh) return [4, straightHigh];
  if(groups[0].c===3) return [3, groups[0].r, ...groups.slice(1).map(g=>g.r)];
  if(groups[0].c===2 && groups[1].c===2) return [2, Math.max(groups[0].r,groups[1].r), Math.min(groups[0].r,groups[1].r), groups[2].r];
  if(groups[0].c===2) return [1, groups[0].r, ...groups.slice(1).map(g=>g.r)];
  return [0, ...ranks];
}
function combosN(arr,k){
  const n=arr.length, result=[];
  function rec(start,chosen){
    if(chosen.length===k){ result.push(chosen.slice()); return; }
    for(let i=start;i<n;i++){ chosen.push(arr[i]); rec(i+1,chosen); chosen.pop(); }
  }
  rec(0,[]);
  return result;
}
function combos5(cards){
  if(cards.length===5) return [cards];
  return combosN(cards,5);
}
function compareHandScores(a,b){
  const len=Math.max(a.length,b.length);
  for(let i=0;i<len;i++){ const av=a[i]??-1, bv=b[i]??-1; if(av!==bv) return av-bv; }
  return 0;
}
function evaluateBest(cards){
  let best=null;
  for(const c5 of combos5(cards)){
    const s=evaluate5(c5);
    if(!best || compareHandScores(s,best)>0) best=s;
  }
  return best;
}
function evaluateOmahaBest(hole, board){
  let best=null;
  for(const h of combosN(hole,2)){
    for(const b of combosN(board,3)){
      const s=evaluate5(h.concat(b));
      if(!best || compareHandScores(s,best)>0) best=s;
    }
  }
  return best;
}
function hasFlushDraw(cards){
  const counts={}; cards.forEach(c=>counts[c.suit]=(counts[c.suit]||0)+1);
  return Object.values(counts).some(c=>c===4);
}
function hasOpenStraightDraw(cards){
  const ranks=[...new Set(cards.map(c=>c.rank))].sort((a,b)=>a-b);
  for(let i=0;i<=ranks.length-4;i++){ if(ranks[i+3]-ranks[i]===3) return true; }
  return false;
}
function preflopStrength(hand){
  const a=hand[0], b=hand[1];
  const hi=Math.max(a.rank,b.rank), lo=Math.min(a.rank,b.rank);
  const suited=a.suit===b.suit, pair=a.rank===b.rank;
  let score=hi/14*0.5 + lo/14*0.3;
  if(pair) score += 0.35 + hi/14*0.15;
  if(suited) score += 0.08;
  const gap=hi-lo;
  if(!pair){ if(gap===1) score+=0.05; else if(gap===2) score+=0.02; else if(gap>=5) score-=0.08; }
  return Math.max(0,Math.min(1,score));
}
function omahaPreflopStrength(hand){
  const ranks=hand.map(c=>c.rank).sort((a,b)=>b-a);
  const suitCount={}; hand.forEach(c=>suitCount[c.suit]=(suitCount[c.suit]||0)+1);
  const maxSuited=Math.max(...Object.values(suitCount));
  const uniqueRanks=new Set(ranks).size;
  let pairBonus=0;
  if(uniqueRanks===3) pairBonus=0.12;
  else if(uniqueRanks<=2) pairBonus=0.22;
  const highAvg=ranks.reduce((a,b)=>a+b,0)/4/14;
  let score=highAvg*0.5+pairBonus;
  if(maxSuited>=2) score+=0.07*(maxSuited-1);
  const spread=ranks[0]-ranks[3];
  if(spread<=4) score+=0.08;
  return Math.max(0,Math.min(1,score));
}
function studPartialStrength(cards){
  const ranks=cards.map(c=>c.rank);
  const counts={}; ranks.forEach(r=>counts[r]=(counts[r]||0)+1);
  const groups=Object.values(counts).sort((a,b)=>b-a);
  const highAvg=ranks.reduce((a,b)=>a+b,0)/ranks.length/14;
  let score=highAvg*0.45;
  if(groups[0]>=3) score+=0.5;
  else if(groups[0]===2) score+=0.25;
  const suitCount={}; cards.forEach(c=>suitCount[c.suit]=(suitCount[c.suit]||0)+1);
  if(Math.max(...Object.values(suitCount))>=3) score+=0.1;
  return Math.max(0,Math.min(1,score));
}
function evaluateFinalHand(p){
  if(variant.id==='omaha') return evaluateOmahaBest(p.hand, state.community);
  if(variant.family==='community') return evaluateBest(p.hand.concat(state.community));
  return evaluateBest(p.hand);
}
function canShowHint(p){
  if(p.folded || !p.hand.length) return false;
  if(variant.family==='community') return state.community.length>0;
  if(variant.family==='stud') return p.hand.length>=5;
  return p.hand.length===5;
}
function handStrength(p, community){
  if(variant.id==='omaha'){
    if(community.length===0) return omahaPreflopStrength(p.hand);
    const score=evaluateOmahaBest(p.hand, community);
    return Math.max(0,Math.min(1, score[0]/8 + (score[1]||0)/14*0.05));
  }
  if(variant.family==='stud'){
    if(p.hand.length<5) return studPartialStrength(p.hand);
    const score=evaluateBest(p.hand);
    return Math.max(0,Math.min(1, score[0]/8 + (score[1]||0)/14*0.05));
  }
  if(variant.family==='draw'){
    const score=evaluateBest(p.hand);
    let base=score[0]/8 + (score[1]||0)/14*0.05;
    if(hasFlushDraw(p.hand)) base+=0.1;
    if(hasOpenStraightDraw(p.hand)) base+=0.08;
    return Math.max(0,Math.min(1,base));
  }
  if(community.length===0) return preflopStrength(p.hand);
  const allCards=p.hand.concat(community);
  const score=evaluateBest(allCards);
  let base=score[0]/8 + (score[1]||0)/14*0.05;
  if(allCards.length<7){
    if(hasFlushDraw(allCards)) base+=0.12;
    if(hasOpenStraightDraw(allCards)) base+=0.10;
  }
  return Math.max(0,Math.min(1,base));
}

/* ---------- state ---------- */
function freshState(){
  return {
    variantId:'holdem',
    players:[
      {idx:0,isHuman:true, name:'You',  avatar:'Y',stack:STARTING_STACK,hand:[],folded:false,allIn:false,betThisRound:0,committed:0,hasActed:false,revealed:false,lastActionLabel:''},
      {idx:1,isHuman:false,name:'Nadia',avatar:'N',stack:STARTING_STACK,hand:[],folded:false,allIn:false,betThisRound:0,committed:0,hasActed:false,revealed:false,lastActionLabel:''},
      {idx:2,isHuman:false,name:'Omar', avatar:'O',stack:STARTING_STACK,hand:[],folded:false,allIn:false,betThisRound:0,committed:0,hasActed:false,revealed:false,lastActionLabel:''},
      {idx:3,isHuman:false,name:'Ken',  avatar:'K',stack:STARTING_STACK,hand:[],folded:false,allIn:false,betThisRound:0,committed:0,hasActed:false,revealed:false,lastActionLabel:''},
    ],
    deck:[], community:[],
    dealerIdx:0, sbIdx:1, bbIdx:2,
    stage:'idle', actingIdx:0,
    currentBet:0, minRaise:BIG_BLIND,
    handNumber:0, handInProgress:false,
    difficulty:'medium', logLines:[],
    lastWinners:[], lastWinningCategory:null,
    humanDiscardSet:[], humanDrawDone:false, drawDoneIdxs:[], pendingSkipBetting:false,
  };
}
let state, players;

function potTotal(){ return players.reduce((s,p)=>s+p.committed,0); }
function dealCard(up){ const c=state.deck.pop(); c.up=!!up; return c; }

/* ---------- hand flow ---------- */
function postBlind(p, amt){
  const pay=Math.min(amt,p.stack);
  p.stack-=pay; p.betThisRound+=pay; p.committed+=pay;
  if(p.stack===0) p.allIn=true;
}
function payAnte(p, amt){
  const pay=Math.min(amt,p.stack);
  p.stack-=pay; p.committed+=pay;
  if(p.stack===0) p.allIn=true;
}
function determineBringIn(){
  let lowest=null;
  players.forEach(p=>{
    if(p.folded) return;
    const upCard=p.hand.find(c=>c.up);
    const val=upCard.rank*4+SUIT_ORDER[upCard.suit];
    if(lowest===null || val<lowest.val) lowest={p,val};
  });
  return lowest.p;
}

function startHand(){
  state.handNumber++;
  state.deck=shuffledDeck();
  state.community=[];
  state.lastWinners=[];
  state.lastWinningCategory=null;
  state.humanDiscardSet=[];
  state.humanDrawDone=false;
  state.drawDoneIdxs=[];
  state.pendingSkipBetting=false;
  players.forEach(p=>{
    if(p.stack<BIG_BLIND){ p.stack=STARTING_STACK; log(`${p.name} reloads to ${STARTING_STACK} chips.`); }
    p.hand=[]; p.folded=false; p.allIn=false; p.betThisRound=0; p.committed=0; p.hasActed=false; p.revealed=false; p.lastActionLabel='';
  });
  state.dealerIdx = state.handNumber===1 ? 0 : nextIdx(state.dealerIdx);
  playSound('deal');

  if(variant.family==='stud'){
    players.forEach(p=>payAnte(p, STUD_ANTE));
    log(`— Hand ${state.handNumber} (${variant.name}) — everyone antes ${STUD_ANTE}.`);
    players.forEach(p=>{ p.hand=[dealCard(false),dealCard(false),dealCard(true)]; });
    const bringInPlayer=determineBringIn();
    state.currentBet=STUD_BRINGIN;
    postBlind(bringInPlayer, STUD_BRINGIN);
    bringInPlayer.lastActionLabel=`Brings in ${STUD_BRINGIN}`;
    log(`${bringInPlayer.name} shows the lowest card and brings in for ${STUD_BRINGIN}.`);
    state.handInProgress=true;
    startBettingRound('third', nextIdx(bringInPlayer.idx));
    return;
  }

  if(variant.family==='draw'){
    const sbIdx=nextIdx(state.dealerIdx), bbIdx=nextIdx(sbIdx);
    state.sbIdx=sbIdx; state.bbIdx=bbIdx;
    state.currentBet=BIG_BLIND;
    postBlind(players[sbIdx], SMALL_BLIND);
    postBlind(players[bbIdx], BIG_BLIND);
    players[sbIdx].lastActionLabel=`Posted SB ${SMALL_BLIND}`;
    players[bbIdx].lastActionLabel=`Posted BB ${BIG_BLIND}`;
    log(`— Hand ${state.handNumber} (${variant.name}) — blinds posted.`);
    players.forEach(p=>{ p.hand=[dealCard(false),dealCard(false),dealCard(false),dealCard(false),dealCard(false)]; });
    state.handInProgress=true;
    startBettingRound('predraw', nextIdx(bbIdx));
    return;
  }

  players.forEach(p=>{ p.hand=Array.from({length:variant.holeCards},()=>dealCard(false)); });
  const sbIdx=nextIdx(state.dealerIdx), bbIdx=nextIdx(sbIdx);
  state.sbIdx=sbIdx; state.bbIdx=bbIdx;
  state.currentBet=BIG_BLIND;
  postBlind(players[sbIdx], SMALL_BLIND);
  postBlind(players[bbIdx], BIG_BLIND);
  players[sbIdx].lastActionLabel=`Posted SB ${SMALL_BLIND}`;
  players[bbIdx].lastActionLabel=`Posted BB ${BIG_BLIND}`;
  log(`— Hand ${state.handNumber} (${variant.name}) — blinds posted.`);
  state.handInProgress=true;
  startBettingRound('preflop', nextIdx(bbIdx));
}

const OPENING_STAGES=['preflop','third','predraw'];
function startBettingRound(stage, firstActorIdx){
  state.stage=stage;
  if(!OPENING_STAGES.includes(stage)){
    state.currentBet=0;
    players.forEach(p=>{ p.betThisRound=0; if(!p.folded) p.lastActionLabel=''; });
  }
  state.minRaise=BIG_BLIND;
  players.forEach(p=>{ if(!p.folded) p.hasActed=false; });
  state.actingIdx = firstActorIdx!==undefined ? firstActorIdx : nextIdx(state.dealerIdx);
  promptAction();
}

function bettingRoundOver(){
  const nonFolded=players.filter(p=>!p.folded);
  if(nonFolded.length<=1) return true;
  const contenders=nonFolded.filter(p=>!p.allIn);
  if(contenders.length===0) return true;
  return contenders.every(p=>p.hasActed && p.betThisRound===state.currentBet);
}

function promptAction(){
  const nonFolded=players.filter(p=>!p.folded);
  if(nonFolded.length<=1){ concludeHand(false); return; }
  if(bettingRoundOver()){ endBettingRound(); return; }
  const p=players[state.actingIdx];
  if(p.folded || p.allIn){ state.actingIdx=nextIdx(state.actingIdx); promptAction(); return; }
  renderAll();
  if(p.isHuman){ /* wait for click */ }
  else { setTimeout(()=>{ if(state.handInProgress && !p.folded) aiDecide(p); }, 650+Math.random()*650); }
}

function afterAction(){
  const nonFolded=players.filter(p=>!p.folded);
  if(nonFolded.length<=1){ concludeHand(false); return; }
  if(bettingRoundOver()){ endBettingRound(); return; }
  state.actingIdx=nextIdx(state.actingIdx);
  promptAction();
}

function dealFlop(){ state.deck.pop(); state.community.push(dealCard(true),dealCard(true),dealCard(true)); log(`Flop: ${state.community.map(cardText).join(' ')}`); playSound('deal'); }
function dealTurn(){ state.deck.pop(); state.community.push(dealCard(true)); log(`Turn: ${cardText(state.community[3])}`); playSound('deal'); }
function dealRiver(){ state.deck.pop(); state.community.push(dealCard(true)); log(`River: ${cardText(state.community[4])}`); playSound('deal'); }
function cardText(c){ return rankLabel(c.rank)+SUIT_SYMBOL[c.suit]; }

function dealStudStreet(stage){
  const faceUp = stage!=='seventh';
  const label = {fourth:'Fourth street',fifth:'Fifth street',sixth:'Sixth street',seventh:'Seventh street'}[stage];
  players.forEach(p=>{ if(!p.folded) p.hand.push(dealCard(faceUp)); });
  log(`${label} dealt${faceUp?' face up':' face down'}.`);
  playSound('deal');
}

function nextStreetGeneric(stage, skipBetting, actorIdx){
  state.stage=stage;
  renderAll();
  if(skipBetting){ setTimeout(()=>endBettingRound(), 850); return; }
  startBettingRound(stage, actorIdx);
}

function endBettingRound(){
  const nonFolded=players.filter(p=>!p.folded);
  const contenders=nonFolded.filter(p=>!p.allIn);
  const skipBetting = contenders.length<=1 && nonFolded.length>1;

  if(variant.family==='draw'){
    if(state.stage==='predraw'){ beginDrawPhase(skipBetting); return; }
    concludeHand(true);
    return;
  }

  if(variant.family==='stud'){
    const seq=['third','fourth','fifth','sixth','seventh'];
    const i=seq.indexOf(state.stage);
    if(i<seq.length-1){ dealStudStreet(seq[i+1]); nextStreetGeneric(seq[i+1], skipBetting, nextIdx(state.dealerIdx)); }
    else concludeHand(true);
    return;
  }

  if(state.stage==='preflop'){ dealFlop(); nextStreetGeneric('flop', skipBetting, nextIdx(state.dealerIdx)); }
  else if(state.stage==='flop'){ dealTurn(); nextStreetGeneric('turn', skipBetting, nextIdx(state.dealerIdx)); }
  else if(state.stage==='turn'){ dealRiver(); nextStreetGeneric('river', skipBetting, nextIdx(state.dealerIdx)); }
  else concludeHand(true);
}

/* ---------- draw phase (Five-Card Draw) ---------- */
function aiDraw(p){
  const ranks=p.hand.map(c=>c.rank);
  const suits=p.hand.map(c=>c.suit);
  const idxs=[0,1,2,3,4];
  const rankCount={}; ranks.forEach(r=>rankCount[r]=(rankCount[r]||0)+1);
  const groups=Object.entries(rankCount).map(([r,c])=>({r:+r,c})).sort((a,b)=>b.c-a.c||b.r-a.r);
  const keepSet=new Set();

  if(groups[0].c===4){ idxs.forEach(i=>{ if(ranks[i]===groups[0].r) keepSet.add(i); }); }
  else if(groups[0].c===3 && groups[1] && groups[1].c===2){ idxs.forEach(i=>keepSet.add(i)); }
  else if(groups[0].c===3){ idxs.forEach(i=>{ if(ranks[i]===groups[0].r) keepSet.add(i); }); }
  else if(groups[0].c===2 && groups[1] && groups[1].c===2){ idxs.forEach(i=>{ if(ranks[i]===groups[0].r||ranks[i]===groups[1].r) keepSet.add(i); }); }
  else if(groups[0].c===2){ idxs.forEach(i=>{ if(ranks[i]===groups[0].r) keepSet.add(i); }); }
  else{
    const suitCount={}; suits.forEach(s=>suitCount[s]=(suitCount[s]||0)+1);
    const flushSuit=Object.keys(suitCount).find(s=>suitCount[s]===4);
    if(flushSuit){ idxs.forEach(i=>{ if(suits[i]===flushSuit) keepSet.add(i); }); }
    else{
      const sortedRanks=[...ranks].sort((a,b)=>a-b);
      let straightRanks=null;
      for(let i=0;i<=1;i++){ if(sortedRanks[i+3]-sortedRanks[i]===3){ straightRanks=sortedRanks.slice(i,i+4); break; } }
      if(straightRanks){
        const used=[];
        idxs.forEach(i=>{ if(!used.includes(ranks[i]) && straightRanks.includes(ranks[i])){ keepSet.add(i); used.push(ranks[i]); } });
      } else {
        const highIdxs=idxs.filter(i=>ranks[i]>=11).sort((a,b)=>ranks[b]-ranks[a]);
        highIdxs.slice(0,2).forEach(i=>keepSet.add(i));
      }
    }
  }
  const discardIdxs=idxs.filter(i=>!keepSet.has(i));
  discardIdxs.forEach(i=>{ p.hand[i]=dealCard(false); });
  p.lastActionLabel = discardIdxs.length===0 ? 'Stood pat' : `Drew ${discardIdxs.length} card${discardIdxs.length>1?'s':''}`;
  log(`${p.name}: ${p.lastActionLabel}.`);
  playSound('deal');
}
function beginDrawPhase(skipPostDrawBetting){
  state.stage='draw-select';
  state.pendingSkipBetting=skipPostDrawBetting;
  state.drawDoneIdxs=players.filter(p=>p.folded).map(p=>p.idx);
  state.humanDrawDone=players[0].folded;
  state.humanDiscardSet=[];
  renderAll();
  players.forEach(p=>{
    if(p.folded || p.isHuman) return;
    setTimeout(()=>{
      aiDraw(p);
      state.drawDoneIdxs=state.drawDoneIdxs.concat(p.idx);
      checkDrawPhaseComplete();
      renderAll();
    }, 550+Math.random()*800);
  });
  checkDrawPhaseComplete();
}
function checkDrawPhaseComplete(){
  if(state.stage!=='draw-select') return;
  const allDone = players.every(p=> p.folded || (p.isHuman ? state.humanDrawDone : state.drawDoneIdxs.includes(p.idx)) );
  if(allDone){
    if(state.pendingSkipBetting){ setTimeout(()=>concludeHand(true), 500); }
    else { setTimeout(()=>startBettingRound('postdraw', nextIdx(state.dealerIdx)), 400); }
  }
}

function distributePot(isShowdown){
  const levels=[...new Set(players.filter(p=>p.committed>0).map(p=>p.committed))].sort((a,b)=>a-b);
  let prev=0; const awards=[];
  for(const level of levels){
    const contributors=players.filter(p=>p.committed>=level);
    const layer=(level-prev)*contributors.length;
    const eligible=contributors.filter(p=>!p.folded);
    if(layer>0 && eligible.length>0){
      let winners, handName=null;
      if(eligible.length===1){ winners=eligible; }
      else{
        const scored=eligible.map(p=>({p,score:evaluateFinalHand(p)}));
        let best=scored[0];
        scored.forEach(s=>{ if(compareHandScores(s.score,best.score)>0) best=s; });
        const tied=scored.filter(s=>compareHandScores(s.score,best.score)===0);
        winners=tied.map(s=>s.p);
        handName=CATS[best.score[0]];
      }
      const share=Math.floor(layer/winners.length);
      let rem=layer-share*winners.length;
      winners.forEach((w,i)=>{
        const amt=share+(i<rem?1:0);
        w.stack+=amt;
        const existing=awards.find(a=>a.player===w);
        if(existing) existing.amount+=amt;
        else awards.push({player:w,name:w.name,amount:amt,handName,split:winners.length>1});
      });
    }
    prev=level;
  }
  players.forEach(p=>p.committed=0);
  return awards;
}

function concludeHand(isShowdown){
  state.handInProgress=false;
  state.stage='showdown';
  const nonFolded=players.filter(p=>!p.folded);
  if(isShowdown) nonFolded.forEach(p=>p.revealed=true);
  const awards=distributePot(isShowdown);
  state.lastWinners=awards.map(a=>a.player.idx);
  state.lastWinningCategory = isShowdown && awards.length ? awards[0].handName : null;
  awards.forEach(a=>{
    a.player.lastActionLabel=`Won ${a.amount} chips`;
    log(`${a.name} wins ${a.amount} chips${a.handName?' with '+a.handName:''}${a.split?' (split pot)':''}.`);
  });
  renderAll();
  triggerResultFeedback();
}

/* ---------- actions ---------- */
function applyAction(p, action, amount){
  const oldCurrentBet=state.currentBet;
  let label='';
  if(action==='fold'){ p.folded=true; label='Folded'; playSound('fold'); }
  else if(action==='check'){ label='Checked'; playSound('check'); }
  else if(action==='call'){
    const toCall=Math.max(0, state.currentBet-p.betThisRound);
    const pay=Math.min(toCall, p.stack);
    p.stack-=pay; p.betThisRound+=pay; p.committed+=pay;
    if(p.stack===0) p.allIn=true;
    label = p.allIn ? `Called ${pay} (all in)` : `Called ${pay}`;
    playSound('bet');
  } else {
    const target=Math.min(amount, p.betThisRound+p.stack);
    const pay=target-p.betThisRound;
    p.stack-=pay; p.betThisRound=target; p.committed+=pay;
    if(p.stack===0) p.allIn=true;
    if(target>oldCurrentBet){
      const increment=target-oldCurrentBet;
      state.currentBet=target;
      state.minRaise=Math.max(BIG_BLIND, increment);
      players.forEach(pl=>{ if(pl!==p && !pl.folded && !pl.allIn) pl.hasActed=false; });
      label=(oldCurrentBet===0?`Bet ${target}`:`Raised to ${target}`) + (p.allIn?' (all in)':'');
    } else {
      label=`Called ${pay}` + (p.allIn?' (all in)':'');
    }
    playSound('bet');
  }
  p.hasActed=true;
  p.lastActionLabel=label;
  log(`${p.name}: ${label}.`);
  renderAll();
  afterAction();
}

function decideBetTarget(p, strength){
  const callAmt=Math.max(0, state.currentBet-p.betThisRound);
  const potAfter=potTotal()+callAmt;
  const frac=0.45+strength*0.55;
  const raiseInc=Math.max(state.minRaise, Math.round(potAfter*frac));
  const target=state.currentBet+raiseInc;
  return Math.min(target, p.betThisRound+p.stack);
}

function aiDecide(p){
  const strength=handStrength(p, state.community);
  const toCall=state.currentBet-p.betThisRound;
  const potOdds=toCall>0 ? toCall/(potTotal()+toCall) : 0;
  const cfg=DIFFICULTY[state.difficulty];
  let eff=strength + (Math.random()*2-1)*cfg.noise;
  eff=Math.max(0,Math.min(1,eff));
  if(Math.random()<cfg.bluffRate && eff<0.4) eff=0.7+Math.random()*0.2;

  if(toCall<=0){
    if(eff>0.55 && Math.random()<cfg.aggression+eff*0.3){ applyAction(p,'bet',decideBetTarget(p,eff)); }
    else { applyAction(p,'check'); }
    return;
  }
  if(eff<0.22 || (eff<potOdds && eff<0.45)){ applyAction(p,'fold'); return; }
  if(eff>0.68 && Math.random()<cfg.aggression+0.15){ applyAction(p,'raise',decideBetTarget(p,eff)); return; }
  applyAction(p,'call');
}

function humanAct(action, amount){
  if(!state.handInProgress || state.actingIdx!==0) return;
  ensureAudio();
  document.getElementById('betControls').hidden=true;
  applyAction(players[0], action, amount);
}

/* ---------- rendering ---------- */
function cardHtml(c, faceUp, idx, interactive, marked){
  const idxAttr = idx!=null ? ` data-idx="${idx}"` : '';
  if(!faceUp) return `<div class="card back"${idxAttr}></div>`;
  const classes=['card'];
  if(isRedSuit(c.suit)) classes.push('red');
  if(marked) classes.push('marked');
  if(interactive) classes.push('selectable');
  return `<div class="${classes.join(' ')}"${idxAttr}>${rankLabel(c.rank)}${SUIT_SYMBOL[c.suit]}</div>`;
}
function cardFaceUp(p, card){
  if(p.isHuman) return true;
  if(p.revealed) return true;
  if(variant.family==='stud') return !!card.up;
  return false;
}
function renderSeat(idx){
  const el=document.getElementById('seat'+idx);
  const p=players[idx];
  const classes=['seat','seat-'+idx];
  if(p.folded) classes.push('folded');
  const isTurn = state.handInProgress && state.actingIdx===idx && !p.folded && !p.allIn && state.stage!=='draw-select';
  if(isTurn) classes.push('active-turn');
  if(!state.handInProgress && state.lastWinners.includes(idx)) classes.push('winner');
  el.className=classes.join(' ');

  const badges=[];
  if(variant.family!=='stud'){
    if(state.dealerIdx===idx) badges.push('<span class="badge dealer">D</span>');
    if(state.sbIdx===idx) badges.push('<span class="badge sb">SB</span>');
    if(state.bbIdx===idx) badges.push('<span class="badge bb">BB</span>');
  }

  const interactiveDraw = idx===0 && state.stage==='draw-select' && !p.folded && !state.humanDrawDone;
  let cardsHtml;
  if(p.hand.length){
    cardsHtml = p.hand.map((c,ci)=>cardHtml(c, cardFaceUp(p,c), interactiveDraw?ci:null, interactiveDraw, interactiveDraw && state.humanDiscardSet.includes(ci))).join('');
  } else {
    const count = variant.holeCards || 2;
    cardsHtml = Array.from({length:count}).map(()=>'<div class="card placeholder"></div>').join('');
  }

  const handHint = (idx===0 && canShowHint(p))
    ? `<div class="hand-hint">${CATS[evaluateFinalHand(p)[0]]}</div>` : '';

  const betHtml = p.betThisRound>0 ? `<div class="seat-bet">● ${p.betThisRound}</div>` : '<div class="seat-bet"></div>';

  el.innerHTML = `
    <div class="seat-head">${badges.join('')}<div class="avatar">${p.avatar}</div><div class="seat-name">${p.name}</div></div>
    <div class="seat-cards">${cardsHtml}</div>
    ${handHint}
    ${betHtml}
    <div class="seat-stack">${p.stack.toLocaleString()} chips</div>
    <div class="seat-status">${escapeHtml(p.lastActionLabel||'')}</div>
  `;

  if(interactiveDraw){
    el.querySelectorAll('.card[data-idx]').forEach(cardEl=>{
      cardEl.addEventListener('click', ()=>{
        const i=+cardEl.dataset.idx;
        const pos=state.humanDiscardSet.indexOf(i);
        if(pos>=0) state.humanDiscardSet.splice(pos,1); else state.humanDiscardSet.push(i);
        renderAll();
      });
    });
  }
}
function renderCommunity(){
  const container=document.getElementById('communityCards');
  if(variant.family!=='community'){
    container.hidden=true;
  } else {
    container.hidden=false;
    const slots=[];
    for(let i=0;i<5;i++){
      slots.push(state.community[i] ? cardHtml(state.community[i],true) : '<div class="card placeholder"></div>');
    }
    container.innerHTML=slots.join('');
  }
  document.getElementById('potAmount').textContent='Pot: '+potTotal().toLocaleString();
}
function renderActionArea(){
  const statusEl=document.getElementById('statusLine');
  const actionRow=document.getElementById('actionRow');
  const betControls=document.getElementById('betControls');
  const drawControls=document.getElementById('drawControls');
  const nextHandBtn=document.getElementById('nextHandBtn');

  if(state.stage==='draw-select'){
    actionRow.hidden=true; betControls.hidden=true; nextHandBtn.hidden=true;
    const human=players[0];
    if(human.folded || state.humanDrawDone){
      drawControls.hidden=true;
      statusEl.textContent = human.folded ? 'Waiting for the draw to finish…' : 'Waiting for opponents to draw…';
    } else {
      drawControls.hidden=false;
      statusEl.textContent='Tap cards to discard, then draw.';
      const n=state.humanDiscardSet.length;
      document.getElementById('confirmDrawBtn').textContent = n===0 ? 'Stand pat' : `Draw ${n} card${n>1?'s':''}`;
    }
    return;
  }
  drawControls.hidden=true;

  if(!state.handInProgress){
    statusEl.textContent='Hand complete.';
    actionRow.hidden=true; betControls.hidden=true; nextHandBtn.hidden=false;
    return;
  }
  nextHandBtn.hidden=true;
  const human=players[0];
  const isHumanTurn = state.actingIdx===0 && !human.folded && !human.allIn;
  if(!isHumanTurn){
    const actor=players[state.actingIdx];
    statusEl.textContent = (actor && !actor.folded && !actor.allIn) ? `${actor.name} is thinking…` : 'Dealing…';
    actionRow.hidden=true; betControls.hidden=true;
    return;
  }
  statusEl.textContent='Your move.';
  actionRow.hidden=false;
  const toCall=state.currentBet-human.betThisRound;
  const ccBtn=document.getElementById('checkCallBtn');
  ccBtn.textContent = toCall>0 ? `Call ${toCall}` : 'Check';
  const canRaise = human.stack > Math.max(0,toCall);
  document.getElementById('betBtn').disabled=!canRaise;
  document.getElementById('allInBtn').disabled = human.stack<=0;
}
function renderLog(){
  const el=document.getElementById('logPanel');
  el.innerHTML=state.logLines.map(l=>`<div>${escapeHtml(l)}</div>`).join('');
  el.scrollTop=el.scrollHeight;
}
function log(msg){
  state.logLines.push(msg);
  if(state.logLines.length>80) state.logLines.shift();
  renderLog();
}

/* ---------- drawer: rankings + rules ---------- */
let drawerMode=null;
function buildRankingsHtml(){
  let html='';
  for(let i=CATS.length-1;i>=0;i--){
    const name=CATS[i];
    const pos=CATS.length-i;
    const won=state.lastWinningCategory===name;
    html+=`<div class="rank-row${won?' won':''}">`
      +`<span class="rank-pos">${pos}</span>`
      +`<span class="rank-name">${name}${won?'<span class="rank-badge">This hand</span>':''}</span>`
      +`<span class="rank-example">${HAND_EXAMPLES[name]}</span>`
      +`</div>`;
  }
  return html;
}
function buildRulesHtml(){
  return `<div class="rules-body">${variant.rulesHtml}<p class="rules-note">Standard high-hand ranking applies in all four variants on this table — see Hand Rankings.</p></div>`;
}
function renderDrawerBody(){
  if(drawerMode==='rankings'){
    document.getElementById('drawerTitle').textContent='Hand rankings';
    document.getElementById('drawerBody').innerHTML=buildRankingsHtml();
  } else if(drawerMode==='rules'){
    document.getElementById('drawerTitle').textContent=`${variant.name} rules`;
    document.getElementById('drawerBody').innerHTML=buildRulesHtml();
  }
}
function openDrawer(mode){
  drawerMode=mode;
  renderDrawerBody();
  document.getElementById('drawerPanel').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
}
function closeDrawer(){
  drawerMode=null;
  document.getElementById('drawerPanel').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
}

function renderVariantRail(){
  const rail=document.getElementById('variantRail');
  rail.innerHTML=VARIANT_ORDER.map(id=>{
    const v=VARIANTS[id];
    const active=v.id===variant.id;
    return `<button class="variant-btn${active?' active':''}" data-variant="${v.id}" type="button">${v.name}<span class="variant-sub">${v.tagline}</span></button>`;
  }).join('');
  rail.querySelectorAll('.variant-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>switchVariant(btn.dataset.variant));
  });
}
function switchVariant(id){
  if(!VARIANTS[id] || id===variant.id) return;
  variant=VARIANTS[id];
  state.variantId=id;
  renderVariantRail();
  players.forEach(p=>{ p.stack=STARTING_STACK; });
  state.handNumber=0;
  state.logLines=[];
  renderLog();
  log(`Switched to ${variant.name}. Table reset.`);
  if(drawerMode==='rules') renderDrawerBody();
  startHand();
}

function renderAll(){
  for(let i=0;i<4;i++) renderSeat(i);
  renderCommunity();
  renderActionArea();
  if(drawerMode==='rankings') renderDrawerBody();
}

/* ---------- bet controls ---------- */
function openBetControls(){
  const human=players[0];
  const minTarget = state.currentBet===0 ? Math.max(state.minRaise,BIG_BLIND) : state.currentBet+state.minRaise;
  const maxTarget = human.betThisRound+human.stack;
  const slider=document.getElementById('betSlider');
  slider.min=Math.min(minTarget,maxTarget);
  slider.max=maxTarget;
  slider.step=Math.max(1, Math.round(BIG_BLIND/2));
  slider.value=Math.min(maxTarget, Math.max(Number(slider.min), Math.round(minTarget*1.5)));
  updateBetDisplay();
  document.getElementById('betControls').hidden=false;
}
function updateBetDisplay(){
  document.getElementById('betAmountDisplay').textContent=document.getElementById('betSlider').value;
}
function setSliderWithinRange(val){
  const slider=document.getElementById('betSlider');
  const clamped=Math.min(Number(slider.max), Math.max(Number(slider.min), Math.round(val)));
  slider.value=clamped;
  updateBetDisplay();
}

/* ---------- wiring ---------- */
function wire(){
  document.getElementById('foldBtn').addEventListener('click', ()=>humanAct('fold'));
  document.getElementById('checkCallBtn').addEventListener('click', ()=>{
    const human=players[0];
    const toCall=state.currentBet-human.betThisRound;
    humanAct(toCall>0?'call':'check');
  });
  document.getElementById('betBtn').addEventListener('click', ()=>{ ensureAudio(); openBetControls(); });
  document.getElementById('allInBtn').addEventListener('click', ()=>{
    const human=players[0];
    const target=human.betThisRound+human.stack;
    humanAct(state.currentBet===0?'bet':'raise', target);
  });
  document.getElementById('betSlider').addEventListener('input', updateBetDisplay);
  document.getElementById('halfPotBtn').addEventListener('click', ()=>setSliderWithinRange(state.currentBet+Math.round(potTotal()*0.5)));
  document.getElementById('potBtn').addEventListener('click', ()=>setSliderWithinRange(state.currentBet+potTotal()));
  document.getElementById('maxBetBtn').addEventListener('click', ()=>{
    const slider=document.getElementById('betSlider'); slider.value=slider.max; updateBetDisplay();
  });
  document.getElementById('confirmBetBtn').addEventListener('click', ()=>{
    const amt=parseInt(document.getElementById('betSlider').value,10);
    humanAct(state.currentBet===0?'bet':'raise', amt);
  });
  document.getElementById('cancelBetBtn').addEventListener('click', ()=>{ document.getElementById('betControls').hidden=true; });
  document.getElementById('confirmDrawBtn').addEventListener('click', ()=>{
    ensureAudio();
    const human=players[0];
    const discardIdxs=state.humanDiscardSet.slice();
    discardIdxs.forEach(i=>{ human.hand[i]=dealCard(false); });
    human.lastActionLabel = discardIdxs.length===0 ? 'Stood pat' : `Drew ${discardIdxs.length} card${discardIdxs.length>1?'s':''}`;
    log(`You: ${human.lastActionLabel}.`);
    playSound('deal');
    state.humanDrawDone=true;
    state.humanDiscardSet=[];
    checkDrawPhaseComplete();
    renderAll();
  });
  document.getElementById('nextHandBtn').addEventListener('click', ()=>{ ensureAudio(); if(!state.handInProgress) startHand(); });
  document.getElementById('difficultySelect').addEventListener('change', e=>{ state.difficulty=e.target.value; });

  document.getElementById('rankingsToggle').addEventListener('click', ()=>{
    drawerMode==='rankings' ? closeDrawer() : openDrawer('rankings');
  });
  document.getElementById('rulesToggle').addEventListener('click', ()=>{
    drawerMode==='rules' ? closeDrawer() : openDrawer('rules');
  });
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  document.getElementById('drawerBackdrop').addEventListener('click', closeDrawer);

  document.getElementById('soundToggle').addEventListener('click', ()=>{
    ensureAudio();
    setSoundEnabled(!soundEnabled);
  });

  document.getElementById('resetBtn').addEventListener('click', ()=>{
    players.forEach(p=>{ p.stack=STARTING_STACK; });
    state.handNumber=0;
    state.logLines=[];
    renderLog();
    log('Table reset.');
    startHand();
  });
}

/* ---------- boot ---------- */
function boot(){
  state = freshState();
  players = state.players;
  variant = VARIANTS[state.variantId] || VARIANTS.holdem;
  wire();
  renderVariantRail();
  document.getElementById('difficultySelect').value = state.difficulty;
  setSoundEnabled(soundEnabled);
  startHand();
}
boot();
