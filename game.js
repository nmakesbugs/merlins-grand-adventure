'use strict';
const GW = 390, GH = 700;

// ── AUDIO ──────────────────────────────────────────────────────────────────
const Audio = (() => {
  let ctx = null;
  const init = () => { if (!ctx) try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} };
  const resume = () => { if (ctx && ctx.state==='suspended') ctx.resume(); };
  const tone = (freq, dur, type='square', vol=0.25) => {
    if (!ctx) return; resume();
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    o.start(); o.stop(ctx.currentTime+dur);
  };
  const noise = (dur, vol=1.0, cap=900) => {
    if (!ctx) return; resume();
    const n=ctx.sampleRate*dur, buf=ctx.createBuffer(1,n,ctx.sampleRate), d=buf.getChannelData(0);
    for (let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const src=ctx.createBufferSource(); src.buffer=buf;
    const flt=ctx.createBiquadFilter(); flt.type='lowpass'; flt.frequency.value=cap;
    const g=ctx.createGain(); src.connect(flt); flt.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(vol,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    src.start();
  };
  return {
    init, resume,
    boof(p=1) {
      init(); resume();
      const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination);
      o.type='sawtooth';
      o.frequency.setValueAtTime(160*p,ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(70*p,ctx.currentTime+0.25);
      g.gain.setValueAtTime(0.5,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);
      o.start(); o.stop(ctx.currentTime+0.3);
    },
    gunshot() { init(); noise(0.14,1.8,900); },
    hit()     { init(); tone(200,0.1,'sawtooth',0.4); },
    snip()    { init(); tone(920,0.04,'square',0.15); },
    fanfare() { init(); [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.18,'square',0.28),i*130)); },
    beep(freq=440,dur=0.1,type='sine',vol=0.2) { try{init();tone(freq,dur,type,vol);}catch(e){} },
    slideDown() {
      try{ init(); resume();
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.connect(g);g.connect(ctx.destination);
        o.type='sine';
        o.frequency.setValueAtTime(820,ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(140,ctx.currentTime+0.48);
        g.gain.setValueAtTime(0.28,ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.48);
        o.start();o.stop(ctx.currentTime+0.5);
      }catch(e){}
    },
    modem() {
      try{ init(); resume();
        const seq=[880,440,660,880,330,660,440,880];
        seq.forEach((f,i)=>{
          const o=ctx.createOscillator(),g=ctx.createGain();
          o.connect(g);g.connect(ctx.destination);
          o.type='square';o.frequency.value=f;
          const t=ctx.currentTime+i*0.09;
          g.gain.setValueAtTime(0.08,t);g.gain.setValueAtTime(0,t+0.07);
          o.start(t);o.stop(t+0.09);
        });
      }catch(e){}
    }
  };
})();

// ── DIALOGUE ───────────────────────────────────────────────────────────────
class Dialogue {
  constructor(scene) {
    this.scene=scene; this.active=false; this.queue=[]; this.onDone=null;
    this._full=''; this._done=false; this._timer=null;
    const W=scene.scale.width, H=scene.scale.height, PH=155;
    this.bg  =scene.add.rectangle(0,H-PH,W,PH,0x080808,0.92).setOrigin(0,0).setDepth(200).setVisible(false).setScrollFactor(0);
    this.bar =scene.add.rectangle(0,H-PH,W,3,0xD4A843).setOrigin(0,0).setDepth(201).setVisible(false).setScrollFactor(0);
    this.spk =scene.add.text(18,H-PH+14,'',{fontSize:'12px',color:'#D4A843',fontFamily:'Fredoka One,sans-serif',letterSpacing:3}).setDepth(202).setVisible(false).setScrollFactor(0);
    this.body=scene.add.text(18,H-PH+36,'',{fontSize:'15px',color:'#F0EAD8',fontFamily:'Nunito,sans-serif',wordWrap:{width:W-36},lineSpacing:5}).setDepth(202).setVisible(false).setScrollFactor(0);
    this.hint=scene.add.text(W-16,H-16,'▶',{fontSize:'13px',color:'#D4A843'}).setOrigin(1,1).setDepth(202).setVisible(false).setScrollFactor(0);
    scene.tweens.add({targets:this.hint,alpha:0.15,duration:550,yoyo:true,repeat:-1});
    scene.input.on('pointerdown',()=>this._tap());
  }
  show(lines,onDone) {
    this.queue=(Array.isArray(lines)?lines:[lines]).slice();
    this.onDone=onDone; this.active=true;
    this._suppress=true;
    this.scene.time.delayedCall(180,()=>{this._suppress=false;});
    this._next();
  }
  _next() {
    if (!this.queue.length) { this._hide(); if (this.onDone) this.onDone(); return; }
    const line=this.queue.shift();
    const spk=typeof line==='string'?'':(line.speaker||'');
    const txt=typeof line==='string'?line:line.text;
    this._full=txt; this._done=false;
    this.spk.setText(spk.toUpperCase()).setVisible(!!spk);
    this.body.setText('');
    [this.bg,this.bar,this.body,this.hint].forEach(o=>o.setVisible(true));
    let i=0;
    if (this._timer){this._timer.remove();this._timer=null;}
    this._timer=this.scene.time.addEvent({delay:22,repeat:txt.length-1,callback:()=>{
      i++; this.body.setText(txt.slice(0,i));
      if(i>=txt.length){this._done=true;this._timer=null;}
    }});
  }
  _tap() {
    if (!this.active||this._suppress) return;
    if (!this._done) { if(this._timer){this._timer.remove();this._timer=null;} this.body.setText(this._full); this._done=true; }
    else this._next();
  }
  _hide() { this.active=false; [this.bg,this.bar,this.spk,this.body,this.hint].forEach(o=>o.setVisible(false)); }
}

// ── TITLE CARD ─────────────────────────────────────────────────────────────
function titleCard(scene, line1, line2, onDone) {
  const W=scene.scale.width, H=scene.scale.height;
  const ov=scene.add.rectangle(W/2,H/2,W,H,0x000000).setAlpha(0).setDepth(500);
  scene.tweens.add({targets:ov,alpha:1,duration:440,onComplete:()=>{
    const t1=scene.add.text(W/2,H/2-44,line1,{fontSize:'18px',color:'#D4A843',fontFamily:'Fredoka One,sans-serif',align:'center'}).setOrigin(0.5).setDepth(501).setAlpha(0);
    const t2=scene.add.text(W/2,H/2+16,line2||'',{fontSize:'25px',color:'#F0EAD8',fontFamily:'Fredoka One,sans-serif',align:'center',wordWrap:{width:W-60}}).setOrigin(0.5).setDepth(501).setAlpha(0);
    scene.tweens.add({targets:[t1,t2],alpha:1,duration:360,delay:160});
    scene.time.delayedCall(2500,()=>{
      scene.tweens.add({targets:[t1,t2,ov],alpha:0,duration:440,onComplete:()=>{
        t1.destroy();t2.destroy();ov.destroy();if(onDone)onDone();
      }});
    });
  }});
}

// ── SPRITE TEXTURES ────────────────────────────────────────────────────────
function buildTextures(scene) {
  function make(key,w,h,fn){const g=scene.make.graphics({x:0,y:0,add:false});fn(g);g.generateTexture(key,w,h);g.destroy();}

  function drawDog(g,legPhase,tongue){
    const lp=legPhase;
    g.fillStyle(0x000000,0.18);g.fillEllipse(66,108,90,14);
    // tail
    g.fillStyle(0x0e0e0e,1);
    [[14,75],[9,62],[5,50],[2,40]].forEach(([x,y],i)=>g.fillCircle(x,y+(lp===0?i*2:-i*2),7-i));
    // body
    g.fillStyle(0x111111,1);g.fillEllipse(66,72,98,60);
    // back legs
    g.fillStyle(0x0c0c0c,1);
    g.fillRoundedRect(28,84,14,lp===0?26:20,5); g.fillRoundedRect(46,84,14,lp===0?20:26,5);
    // front legs
    g.fillRoundedRect(78,84,14,lp===0?20:26,5); g.fillRoundedRect(96,84,14,lp===0?26:20,5);
    // neck + head
    g.fillStyle(0x111111,1);g.fillEllipse(100,52,34,36);
    g.fillStyle(0x1c1c1c,1);g.fillCircle(108,32,30);
    // snout
    g.fillStyle(0x242424,1);g.fillEllipse(122,40,28,20);
    // nose
    g.fillStyle(0x0e0e0e,1);g.fillEllipse(128,35,15,10);
    // ears
    g.fillStyle(0x0d0d0d,1);g.fillEllipse(92,14,20,30);g.fillEllipse(118,11,18,28);
    // eyes
    g.fillStyle(0x8B5E3C,1);g.fillCircle(99,26,7);g.fillCircle(115,23,7);
    g.fillStyle(0x2a1500,1);g.fillCircle(99,26,4);g.fillCircle(115,23,4);
    g.fillStyle(0xFFFFFF,1);g.fillCircle(101,24,2);g.fillCircle(117,21,2);
    // pizza collar
    g.fillStyle(0x4488DD,1);g.fillRoundedRect(84,58,30,9,3);
    g.fillStyle(0xFFD700,1);[87,93,99,105].forEach(cx=>g.fillCircle(cx,62,2));
    // tongue
    if(tongue){g.fillStyle(0xFF9FB5,1);g.fillEllipse(124,54,14,22);g.fillStyle(0xE888A0,1);g.fillRect(123,44,2,14);}
  }

  make('merlin-w1', 145,115,g=>drawDog(g,0,false));
  make('merlin-w2', 145,115,g=>drawDog(g,1,false));
  make('merlin-idle',145,115,g=>drawDog(g,0,false));
  make('merlin-happy',145,115,g=>drawDog(g,0,true));

  make('merlin-sit',125,125,g=>{
    g.fillStyle(0x000000,0.18);g.fillEllipse(56,114,82,14);
    g.fillStyle(0x0e0e0e,1);[[12,84],[8,72],[5,60]].forEach(([x,y],i)=>g.fillCircle(x,y,8-i*2));
    g.fillStyle(0x111111,1);g.fillEllipse(58,90,82,42);g.fillEllipse(58,66,72,60);g.fillEllipse(68,44,30,34);
    g.fillStyle(0x1c1c1c,1);g.fillCircle(74,28,30);
    g.fillStyle(0x242424,1);g.fillEllipse(88,38,28,20);
    g.fillStyle(0x0e0e0e,1);g.fillEllipse(94,33,15,10);
    g.fillStyle(0x0d0d0d,1);g.fillEllipse(58,12,18,28);g.fillEllipse(82,9,17,26);
    g.fillStyle(0x8B5E3C,1);g.fillCircle(64,22,6);g.fillCircle(79,20,6);
    g.fillStyle(0x2a1500,1);g.fillCircle(64,22,3);g.fillCircle(79,20,3);
    g.fillStyle(0xFFFFFF,1);g.fillCircle(66,20,2);g.fillCircle(81,18,2);
    g.fillStyle(0x111111,1);g.fillRoundedRect(36,92,22,24,8);g.fillRoundedRect(60,92,22,24,8);
    g.fillStyle(0xFF9FB5,1);g.fillEllipse(90,50,14,22);
    g.fillStyle(0xE888A0,1);g.fillRect(89,41,2,13);
    g.fillStyle(0x4488DD,1);g.fillRoundedRect(50,52,28,8,3);
    g.fillStyle(0xFFD700,1);[54,60,66,72].forEach(cx=>g.fillCircle(cx,56,2));
  });

  make('mom',74,158,g=>{
    // Legs
    g.fillStyle(0xB06030,1);g.fillRoundedRect(13,124,16,28,4);g.fillRoundedRect(35,124,16,28,4);
    // Green dress
    g.fillStyle(0x4A7A38,1);g.fillRoundedRect(8,54,58,76,6);
    g.fillStyle(0x5A9A48,0.35);g.fillRoundedRect(12,58,22,60,4);
    // Arms
    g.fillStyle(0xB06030,1);g.fillRoundedRect(2,56,10,44,5);g.fillRoundedRect(62,56,10,44,5);
    // Hair circle drawn FIRST — center at y=38, r=27 → top at y=11 (well within texture, rounded top)
    g.fillStyle(0x2A1000,1);g.fillCircle(37,38,27);
    // Head circle ON TOP — center at y=46, r=22 → hair shows above and at sides
    g.fillStyle(0xB06030,1);g.fillCircle(37,46,22);
    // Eyes
    g.fillStyle(0x1A0A00,1);g.fillCircle(28,44,4);g.fillCircle(46,44,4);
    g.fillStyle(0xFFFFFF,1);g.fillCircle(30,42,1.5);g.fillCircle(48,42,1.5);
    // Smile
    g.lineStyle(2,0x1A0A00,1);g.beginPath();g.arc(37,50,7,0.2,Math.PI-0.2);g.strokePath();
  });

  make('clippers',62,32,g=>{
    g.fillStyle(0x888888,1);g.fillRoundedRect(4,3,54,13,4);
    g.fillStyle(0xAAAAAA,1);g.fillRoundedRect(4,16,54,10,3);
    g.fillStyle(0x666666,1);g.fillRect(8,6,46,5);
    g.fillStyle(0xDDDDDD,1);g.fillRect(25,2,14,4);
  });

  make('star',36,36,g=>{
    g.fillStyle(0xFFD700,1);
    g.fillTriangle(18,2,22,16,14,16);g.fillTriangle(18,34,22,20,14,20);
    g.fillTriangle(2,18,16,14,16,22);g.fillTriangle(34,18,20,14,20,22);
    g.fillStyle(0xFFFFAA,1);g.fillCircle(18,18,5);
  });

  make('sock',30,13,g=>{
    g.fillStyle(0xDDDDDD,1);g.fillRoundedRect(0,0,22,13,4);g.fillRoundedRect(14,4,16,9,3);
    g.lineStyle(1,0xBBBBBB,0.6);g.strokeRect(1,1,20,11);
  });

  make('floor',64,64,g=>{
    g.fillStyle(0xC4A274,1);g.fillRect(0,0,64,64);
    g.lineStyle(1,0xAA8855,0.5);g.strokeRect(2,2,60,60);
  });

  // ── BAR TEXTURES (Ch2) ──────────────────────────────────────────────────
  make('bartender',80,150,g=>{
    g.fillStyle(0x111111,1);g.fillRoundedRect(14,118,18,30,4);g.fillRoundedRect(38,118,18,30,4);
    g.fillStyle(0x222244,1);g.fillRoundedRect(12,82,56,42,4);
    g.fillStyle(0xF0F0F0,1);g.fillRoundedRect(16,50,48,68,3);
    g.fillStyle(0xDDDDDD,1);g.fillRect(16,70,48,2);
    g.fillStyle(0x2a2a3a,1);g.fillRoundedRect(10,42,60,52,5);
    g.fillStyle(0xC8A888,1);g.fillRoundedRect(2,44,12,45,5);g.fillRoundedRect(66,44,12,45,5);
    // Hair FIRST then head on top
    g.fillStyle(0x1a1000,1);g.fillCircle(40,36,26);
    g.fillStyle(0xC8A888,1);g.fillCircle(40,44,22);
    g.fillStyle(0x1a1000,1);g.fillEllipse(40,52,22,7);
    g.fillStyle(0x2a2a2a,1);g.fillCircle(31,43,4);g.fillCircle(49,43,4);
    g.fillStyle(0xFFFFFF,1);g.fillCircle(33,41,1.5);g.fillCircle(51,41,1.5);
    g.fillStyle(0xCC2222,1);g.fillTriangle(32,60,40,64,32,68);g.fillTriangle(48,60,40,64,48,68);g.fillCircle(40,64,4);
  });

  make('lady',80,170,g=>{
    g.fillStyle(0x880000,1);g.fillRect(14,155,20,12);g.fillRect(46,155,20,12);g.fillRect(28,159,10,8);g.fillRect(60,159,10,8);
    g.fillStyle(0xCC2244,1);g.fillRoundedRect(12,62,56,98,5);
    g.fillStyle(0xFF4466,0.3);g.fillRoundedRect(16,66,20,82,4);
    g.fillStyle(0xE8C0A0,1);g.fillRoundedRect(2,64,12,50,5);g.fillRoundedRect(66,64,12,50,5);
    g.fillStyle(0x1a0800,1);g.fillCircle(40,40,28);g.fillEllipse(40,24,28,22);
    g.fillStyle(0xE8C0A0,1);g.fillCircle(40,48,22);
    g.fillStyle(0x1a0a0a,1);g.fillCircle(30,46,5);g.fillCircle(50,46,5);
    g.fillStyle(0xFFFFFF,1);g.fillCircle(32,44,2);g.fillCircle(52,44,2);
    g.fillStyle(0xCC1133,1);g.fillEllipse(40,58,14,7);
    g.fillStyle(0xFFD700,1);g.fillRect(28,62,24,3);
  });

  // ── CH3 TEXTURES ────────────────────────────────────────────────────────
  make('sketchy',72,148,g=>{
    g.fillStyle(0x111111,1);g.fillRoundedRect(10,130,22,16,3);g.fillRoundedRect(40,130,22,16,3);
    g.fillStyle(0x444440,1);g.fillRoundedRect(14,88,44,48,4);
    g.fillStyle(0x222228,1);g.fillRoundedRect(8,44,56,50,5);
    g.fillStyle(0x1e1e24,1);g.fillRoundedRect(0,46,12,52,5);g.fillRoundedRect(60,46,12,52,5);
    g.fillStyle(0xC0A080,1);g.fillCircle(6,97,6);g.fillCircle(66,97,6);
    g.fillStyle(0xC0A080,1);g.fillRect(30,36,12,14);
    g.fillStyle(0xC0A080,1);g.fillEllipse(36,25,34,36);
    g.fillStyle(0x1a1a20,1);g.fillEllipse(36,16,44,28);g.fillEllipse(36,24,46,20);
    g.fillStyle(0x080808,1);g.fillRect(22,22,10,5);g.fillRect(40,22,10,5);
    g.fillStyle(0xFF4444,0.7);g.fillCircle(27,24,3);g.fillCircle(45,24,3);
    g.lineStyle(2,0xC0A080,1);g.beginPath();g.arc(36,34,6,0.3,Math.PI*0.8);g.strokePath();
  });

  make('vending',100,180,g=>{
    g.fillStyle(0xDDEEFF,1);g.fillRoundedRect(0,0,100,180,6);
    g.fillStyle(0xBBCCDD,1);g.fillRoundedRect(3,3,94,174,5);
    g.fillStyle(0x88AACC,1);g.fillRoundedRect(10,10,80,60,4);
    g.fillStyle(0xAADDFF,1);g.fillRoundedRect(12,12,76,56,3);
    g.fillStyle(0x224488,0.8);g.fillRect(14,22,50,6);g.fillRect(14,32,38,5);g.fillRect(14,42,44,4);
    g.fillStyle(0x334455,1);g.fillRoundedRect(35,78,30,10,3);
    g.fillStyle(0x111122,1);g.fillRect(44,80,12,6);
    g.fillStyle(0x556677,1);g.fillRect(20,82,14,4);g.fillRect(66,82,14,4);
    for(let r=0;r<2;r++) for(let c=0;c<3;c++){
      g.fillStyle(0xCCDDEE,1);g.fillRoundedRect(8+c*30,96+r*36,26,32,3);
      g.fillStyle(0xFFFFFF,0.6);g.fillRoundedRect(10+c*30,98+r*36,22,18,2);
    }
    g.fillStyle(0x8899AA,1);g.fillRoundedRect(8,168,84,10,3);
    g.fillStyle(0x667788,1);g.fillRect(12,169,76,5);
  });

  make('token',40,40,g=>{
    g.fillStyle(0xCCBB00,1);g.fillCircle(20,20,18);
    g.fillStyle(0xDDCC11,1);g.fillCircle(20,20,15);
    g.fillStyle(0xAA9900,1);g.fillCircle(20,20,10);
    g.fillStyle(0xDDCC11,1);g.fillRect(17,12,6,16);g.fillRect(12,17,16,6);
  });

  make('packet',50,30,g=>{
    g.fillStyle(0xEEEEEE,1);g.fillRoundedRect(0,0,50,30,4);
    g.fillStyle(0xCCCCCC,1);g.fillRect(0,14,50,2);
    g.lineStyle(1,0xAAAAAA,0.8);g.strokeRect(2,2,46,26);
    g.fillStyle(0x3355AA,1);g.fillRect(8,6,34,8);
    g.fillStyle(0xFFFFFF,0.9);g.fillRect(10,8,8,4);g.fillRect(26,8,12,4);
    g.fillStyle(0xDDDDDD,1);g.fillTriangle(0,0,8,0,0,8);
  });

  make('couch',220,100,g=>{
    g.fillStyle(0x7A5A3A,1);g.fillRoundedRect(0,50,220,50,8);
    g.fillStyle(0x9A7A5A,1);g.fillRoundedRect(4,30,102,50,6);g.fillRoundedRect(114,30,102,50,6);
    g.lineStyle(2,0x7A5A3A,0.5);g.lineBetween(110,32,110,78);
    g.fillStyle(0x8A6A4A,1);g.fillRoundedRect(0,18,220,22,6);
    g.fillStyle(0x6A4A2A,1);g.fillRoundedRect(0,18,24,70,5);g.fillRoundedRect(196,18,24,70,5);
    g.fillStyle(0x3A2010,1);g.fillRect(8,92,16,8);g.fillRect(196,92,16,8);
  });
}

// ── BOOT SCENE ─────────────────────────────────────────────────────────────
class BootScene extends Phaser.Scene {
  constructor(){super('BootScene');}
  create(){
    buildTextures(this);
    const W=this.scale.width,H=this.scale.height;
    this.cameras.main.setBackgroundColor('#100800');
    this.add.text(W/2,H/2-130,"MERLIN'S",{fontSize:'48px',color:'#D4A843',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5);
    this.add.text(W/2,H/2-70,'GRAND ADVENTURE',{fontSize:'24px',color:'#F0EAD8',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5);
    this.add.sprite(W/2,H/2+62,'merlin-sit').setScale(1.55);
    this.add.text(W/2,H/2+180,'A story about a very good boy\nwho briefly went outside.',{fontSize:'13px',color:'#9A8A6A',fontFamily:'Nunito,sans-serif',align:'center',lineSpacing:4}).setOrigin(0.5);
    const tap=this.add.text(W/2,H-70,'TAP TO BEGIN',{fontSize:'17px',color:'#D4A843',fontFamily:'Fredoka One,sans-serif',letterSpacing:5}).setOrigin(0.5);
    this.tweens.add({targets:tap,alpha:0.15,duration:680,yoyo:true,repeat:-1});
    this.input.once('pointerdown',()=>{
      Audio.init();Audio.resume();Audio.boof();
      this.cameras.main.fadeOut(400);
      this.time.delayedCall(400,()=>this.scene.start('PrologueScene'));
    });
  }
}

// ── PROLOGUE SCENE ─────────────────────────────────────────────────────────
class PrologueScene extends Phaser.Scene {
  constructor(){super('PrologueScene');}
  create(){
    this.cameras.main.fadeIn(600);
    const W=this.scale.width,H=this.scale.height;
    this._buildRoom(W,H);
    this.merlin=this.add.sprite(-90,H-152,'merlin-w1').setFlipX(true).setDepth(10);
    this.dlg=new Dialogue(this);
    this.time.delayedCall(700,()=>this._enter());
  }
  _walk(toX,dur,onDone){
    let f=0;
    this.tweens.add({targets:this.merlin,x:toX,duration:dur,ease:'Linear',
      onUpdate:()=>{f++;this.merlin.setTexture(f%14<7?'merlin-w1':'merlin-w2');},
      onComplete:()=>{this.merlin.setTexture('merlin-idle');if(onDone)onDone();}});
  }
  _buildRoom(W,H){
    this.add.rectangle(W/2,H/2,W,H,0xE8DCC8);
    for(let x=0;x<W;x+=64)this.add.image(x+32,H-40,'floor');
    this.add.rectangle(W/2,H-82,W,44,0xB89060);
    this.add.rectangle(W/2,H-124,W,8,0xD0B07A);
    // window
    this.add.rectangle(92,H/2-92,80,100,0xA8C8E8);
    this.add.rectangle(92,H/2-92,86,106,0x000000,0).setStrokeStyle(5,0x8B6914);
    this.add.rectangle(92,H/2-92,2,106,0x8B6914);
    this.add.rectangle(92,H/2-92,86,2,0x8B6914);
    this.add.triangle(92,H/2-144,-32,0,116,0,230,H/2+55,0xFFFFCC,0.06);
    // couch
    this.add.rectangle(W/2-50,H-170,182,56,0x7A5A3A).setDepth(2);
    this.add.rectangle(W/2-50,H-190,182,22,0x9A7A5A).setDepth(3);
    this.add.rectangle(W/2-112,H-175,80,50,0x9A7A5A).setDepth(3);
    this.add.rectangle(W/2+12,H-175,80,50,0x9A7A5A).setDepth(3);
    // rug
    this.add.rectangle(W/2-20,H-103,225,52,0x8B3030,0.5);
    // door
    this.doorBg  =this.add.rectangle(W-44,H-155,70,168,0x9A7220).setDepth(5);
    this.doorFace=this.add.rectangle(W-44,H-155,66,164,0xB28830).setDepth(6);
    this.knob    =this.add.circle(W-20,H-160,7,0xD4A830).setDepth(7);
    this.add.rectangle(W-44,H-242,74,30,0x9A7220).setDepth(5);
  }
  _enter(){
    this._walk(158,1700,()=>{
      this.dlg.show([
        'This is Merlin.',
        'He is 3 years old. He has never left this house.',
        'He does not want to. This house has everything.',
      ],()=>this._sniff());
    });
  }
  _sniff(){
    const W=this.scale.width,H=this.scale.height;
    this.sock=this.add.image(W/2+94,H-133,'sock').setDepth(9);
    this.dlg.show([
      {speaker:'Merlin',text:'The Boys. The Smells. The Cuddles. Dad. Mom.'},
      {speaker:'Merlin',text:'Boys smell like happy and their food is so salty and delicious.'},
      {speaker:'Merlin',text:'OH. A sock. This is mine now.'},
    ],()=>{
      this._walk(W/2+70,750,()=>{
        Audio.boof();
        this.sock.setVisible(false);
        this.merlin.setTexture('merlin-happy');
        this.time.delayedCall(350,()=>this._momEnters());
      });
    });
  }
  _momEnters(){
    const W=this.scale.width,H=this.scale.height;
    this.mom=this.add.sprite(W+50,H-172,'mom').setDepth(8);
    this.clippers=this.add.sprite(0,0,'clippers').setDepth(9).setVisible(false);
    this.tweens.add({targets:this.mom,x:W/2+120,duration:1000,ease:'Power2',onComplete:()=>{
      this.clippers.setPosition(W/2+142,H-235).setVisible(true);
      this.merlin.setTexture('merlin-idle');
      this.dlg.show([
        {speaker:'Merlin',text:'Mom is here. Mom smells like safe.'},
        {speaker:'Merlin',text:'...Wait.'},
        {speaker:'Merlin',text:'Those are the CLICKING THINGS.'},
        {speaker:'Merlin',text:'Merlin does not like the clicking things. But Merlin is also very brave.'},
      ],()=>this._nailCut());
    }});
  }
  _nailCut(){
    let snips=0;
    const doSnip=()=>{
      if(snips>=4){this._handsome();return;}
      Audio.snip(); snips++;
      this.tweens.add({targets:this.merlin,scaleY:0.80,duration:75,yoyo:true,
        onComplete:()=>this.time.delayedCall(200,doSnip)});
    };
    doSnip();
  }
  _handsome(){
    const W=this.scale.width,H=this.scale.height;
    this.tweens.add({targets:[this.mom,this.clippers],x:W+110,duration:820,ease:'Power2'});
    this.merlin.setTexture('merlin-sit').setPosition(W/2-50,H-130);
    for(let i=0;i<7;i++){
      const s=this.add.image(
        this.merlin.x+Phaser.Math.Between(-72,72),
        this.merlin.y-Phaser.Math.Between(12,92),'star'
      ).setDepth(15).setAlpha(0).setScale(0.4);
      this.tweens.add({targets:s,alpha:1,scale:1.2,y:s.y-30,duration:460,delay:i*85,yoyo:true,ease:'Sine.easeOut',onComplete:()=>s.destroy()});
    }
    this.dlg.show([
      'And then Merlin felt it.',
      {speaker:'Merlin',text:'Merlin is HANDSOME.'},
      {speaker:'Merlin',text:"Merlin's paws are very neat and correct."},
      'And then he realized.',
      {speaker:'Merlin',text:'His life was getting past him.'},
      {speaker:'Merlin',text:'He needed an Adventure.'},
    ],()=>this._toDoor());
  }
  _toDoor(){
    const W=this.scale.width,H=this.scale.height;
    this.merlin.setTexture('merlin-idle').setFlipX(true).setPosition(W/2-55,H-152);
    this.dlg.show([
      {speaker:'Merlin',text:'Merlin has never gone out the front door. Not once. Not ever.'},
      {speaker:'Merlin',text:'Outside smells like EVERYTHING. This is probably illegal.'},
      {speaker:'Merlin',text:'Merlin is going anyway.'},
    ],()=>{
      this.tweens.add({targets:this.doorBg, scaleX:0.07,x:W-8,duration:700});
      this.tweens.add({targets:this.doorFace,scaleX:0.07,x:W-8,duration:700});
      this.tweens.add({targets:this.knob,   alpha:0,duration:480});
      const beam=this.add.rectangle(W-62,H/2-42,124,H,0xFFFFDD).setAlpha(0).setDepth(4);
      this.tweens.add({targets:beam,alpha:0.22,duration:700});
      this.time.delayedCall(760,()=>{
        this._walk(W+90,1250,()=>{
          titleCard(this,'CHAPTER 1','"MERLIN GETS INTO A GUNFIGHT"',()=>{
            this.cameras.main.fadeOut(400);
            this.time.delayedCall(400,()=>this.scene.start('Ch1IntroScene'));
          });
        });
      });
    });
  }
}

// ── CH1 INTRO SCENE ────────────────────────────────────────────────────────
class Ch1IntroScene extends Phaser.Scene {
  constructor(){super('Ch1IntroScene');}
  create(){
    this.cameras.main.fadeIn(500);
    const W=this.scale.width,H=this.scale.height;
    this._buildAlley(W,H);
    this.merlin=this.add.sprite(-75,H-158,'merlin-w1').setFlipX(true).setDepth(10);
    this.dlg=new Dialogue(this);
    this.time.delayedCall(350,()=>this._enter());
  }
  _buildAlley(W,H){
    this.add.rectangle(W/2,H/2,W,H,0x06060f);
    for(let i=0;i<45;i++) this.add.circle(Phaser.Math.Between(0,W),Phaser.Math.Between(0,H*0.38),Phaser.Math.Between(1,2),0xFFFFFF,Phaser.Math.FloatBetween(0.25,1));
    [[0,100,215],[90,66,300],[145,96,178],[230,76,308],[295,86,238],[362,72,198]].forEach(([x,w,th])=>{
      this.add.rectangle(x+w/2,H-120-th/2,w,th,0x0c0c18);
      for(let wy=0;wy<5;wy++) for(let wx=0;wx<3;wx++) if(Math.random()>0.48) this.add.rectangle(x+10+wx*(w/3),H-120-th+22+wy*28,11,16,0xFFFF77,0.65);
    });
    this.add.rectangle(24,H-200,48,400,0x161c10);this.add.rectangle(W-24,H-200,48,400,0x161c10);
    for(let y=H-380;y<H-120;y+=18){this.add.rectangle(24,y,46,1,0x1e2818,0.7);this.add.rectangle(W-24,y,46,1,0x1e2818,0.7);}
    this.add.rectangle(W/2,H-82,W,164,0x111108);
    this.add.ellipse(W/2-55,H-108,85,18,0x1a2830,0.75);
    this.add.ellipse(W/2+82,H-115,52,12,0x1a2830,0.55);
    this.add.rectangle(W/2,H-315,5,300,0x404040);
    this.add.circle(W/2,H-317,11,0xFFFFBB);
    this.add.circle(W/2,H-317,58,0xFFFFBB,0.06);
    this.add.rectangle(78,H-140,28,50,0x3a3a3a);this.add.rectangle(78,H-168,32,10,0x4a4a4a);
    this.add.rectangle(W-78,H-140,28,50,0x2e2e2e);this.add.rectangle(W-78,H-168,32,10,0x3e3e3e);
  }
  _makeDude(x,y,bodyColor){
    const g=this.add.graphics().setDepth(10);
    g.fillStyle(bodyColor,1);g.fillRoundedRect(-14,-60,28,60,4);
    g.fillStyle(0xC8A478,1);g.fillCircle(0,-72,15);
    g.fillStyle(0x111111,1);g.fillRect(-16,-89,32,7);g.fillRect(-10,-103,20,18);
    g.fillStyle(0x111111,1);g.fillRect(-11,0,10,26);g.fillRect(1,0,10,26);
    g.fillStyle(0x555555,0.8);g.fillCircle(14,-24,5);
    g.setPosition(x,y);
    return g;
  }
  _enter(){
    const W=this.scale.width,H=this.scale.height; let f=0;
    this.tweens.add({targets:this.merlin,x:W/2-88,duration:1650,ease:'Linear',
      onUpdate:()=>{f++;this.merlin.setTexture(f%14<7?'merlin-w1':'merlin-w2');},
      onComplete:()=>{
        this.merlin.setTexture('merlin-idle');
        this.dlg.show([
          {speaker:'Merlin',text:'Outside is... a lot.'},
          {speaker:'Merlin',text:'So many smells. Some of them are concerning.'},
          {speaker:'Merlin',text:'Merlin is very handsome though. Merlin is okay.'},
        ],()=>this._badDudes());
      }});
  }
  _badDudes(){
    const W=this.scale.width,H=this.scale.height,fy=H-158;
    this.d1=this._makeDude(W+30,fy,0x1e2418);
    this.d2=this._makeDude(W+74,fy,0x1a1a1a);
    this.d3=this._makeDude(W+118,fy,0x221818);
    [[W/2+64,this.d1],[W/2+110,this.d2],[W/2+156,this.d3]].forEach(([tx,d],i)=>{
      this.tweens.add({targets:d,x:tx,duration:920,ease:'Power2',
        onComplete:i===2?()=>this._confront():undefined});
    });
  }
  _confront(){
    this.dlg.show([
      {speaker:'Bad Dude 1',text:"Yo. That's a nice dog. We could use him."},
      {speaker:'Merlin',    text:'Oh these men want to be friends. Merlin loves friends.'},
      {speaker:'Bad Dude 2',text:'Fighting dog operation. Perfect.'},
      {speaker:'Merlin',    text:'Fighting. Merlin knows fighting. That is when Thor takes the good spot on the couch.'},
      {speaker:'Bad Dude 1',text:'Get him.'},
      {speaker:'Merlin',    text:'That one has a LOUD STICK. Merlin does not like loud sticks.'},
      {speaker:'Merlin',    text:'But also. MERLIN WANTS IT.'},
    ],()=>this._wrestle());
  }
  _wrestle(){
    this.cameras.main.flash(280,220,220,220);Audio.boof(1.6);
    this.dlg.show([
      'Merlin moved faster than anyone expected.',
      'Merlin moved faster than Merlin expected.',
      {speaker:'Merlin',text:'Merlin has the loud stick. Merlin is the loud stick now.'},
    ],()=>{
      this.cameras.main.fadeOut(600);
      this.time.delayedCall(600,()=>this.scene.start('Ch1FPSScene'));
    });
  }
}

// ── FPS ENGINE (Wolfenstein raycaster — runs outside Phaser) ───────────────
class MerlinFPS {
  constructor(onWin,onLose){
    this.onWin=onWin; this.onLose=onLose;
    this.running=false; this.animFrame=null; this.lastTime=0;
    this.map=[
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ];
    this.player={x:2.5,y:4.5,angle:0,fov:Math.PI/2.8,speed:0.042,rotSpeed:0.026,health:5,ammo:18};
    this.enemies=[
      {x:8.5, y:4.5,health:2,type:'strafe',   shootTimer:3.2,hitFlash:0,alive:true,sdir:1},
      {x:12.5,y:2.5,health:2,type:'stationary',shootTimer:2.6,hitFlash:0,alive:true,sdir:1},
      {x:12.5,y:6.5,health:2,type:'advance',  shootTimer:4.2,hitFlash:0,alive:true,sdir:1},
    ];
    this.keys={fwd:false,back:false,sl:false,sr:false,rl:false,rr:false,shoot:false};
    this.shootCD=0; this.dmgCD=0; this.zbuf=[]; this.flash=0;
    this._buildDOM();
  }

  _buildDOM(){
    this.root=document.createElement('div');
    this.root.id='fps-container';
    this.root.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:9999;touch-action:none;user-select:none;overflow:hidden;';
    document.body.appendChild(this.root);

    this.canvas=document.createElement('canvas');
    this.W=Math.min(window.innerWidth,480);
    this.H=window.innerHeight;
    this.canvas.width=this.W; this.canvas.height=this.H;
    this.canvas.style.cssText=`position:absolute;top:0;left:50%;transform:translateX(-50%);width:${this.W}px;height:${this.H}px;`;
    this.ctx=this.canvas.getContext('2d');
    this.root.appendChild(this.canvas);

    const hud=document.createElement('div');
    hud.style.cssText=`position:absolute;top:0;left:50%;transform:translateX(-50%);width:${this.W}px;height:${this.H}px;pointer-events:none;z-index:10;`;

    this.healthEl=document.createElement('div');
    this.healthEl.style.cssText='position:absolute;top:12px;left:12px;font-size:22px;display:flex;gap:5px;';
    hud.appendChild(this.healthEl); this._drawHealth();

    this.ammoEl=document.createElement('div');
    this.ammoEl.style.cssText='position:absolute;top:14px;right:12px;color:#D4A843;font-size:17px;font-family:"Fredoka One",sans-serif;';
    this.ammoEl.textContent='🔫 '+this.player.ammo;
    hud.appendChild(this.ammoEl);

    const xh=document.createElement('div');
    xh.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);';
    xh.innerHTML='<svg width="22" height="22"><line x1="11" y1="0" x2="11" y2="22" stroke="rgba(255,255,255,0.6)" stroke-width="1.2"/><line x1="0" y1="11" x2="22" y2="11" stroke="rgba(255,255,255,0.6)" stroke-width="1.2"/><circle cx="11" cy="11" r="2.5" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1"/></svg>';
    hud.appendChild(xh);

    this.flashEl=document.createElement('div');
    this.flashEl.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    hud.appendChild(this.flashEl);

    this.capEl=document.createElement('div');
    this.capEl.style.cssText='position:absolute;bottom:198px;left:0;right:0;text-align:center;color:#F0EAD8;font-size:14px;font-family:Nunito,sans-serif;padding:8px 18px;background:rgba(0,0,0,0.78);border-top:2px solid #D4A843;opacity:0;transition:opacity 0.3s;';
    hud.appendChild(this.capEl);
    this.root.appendChild(hud);

    this._buildControls();

    // keyboard
    window.addEventListener('keydown',this._kd=e=>{
      if(e.key==='ArrowUp'  ||e.key==='w')this.keys.fwd =true;
      if(e.key==='ArrowDown'||e.key==='s')this.keys.back=true;
      if(e.key==='ArrowLeft'||e.key==='a')this.keys.rl  =true;
      if(e.key==='ArrowRight'||e.key==='d')this.keys.rr =true;
      if(e.key===' '||e.key==='f')         this.keys.shoot=true;
    });
    window.addEventListener('keyup',this._ku=e=>{
      if(e.key==='ArrowUp'  ||e.key==='w')this.keys.fwd =false;
      if(e.key==='ArrowDown'||e.key==='s')this.keys.back=false;
      if(e.key==='ArrowLeft'||e.key==='a')this.keys.rl  =false;
      if(e.key==='ArrowRight'||e.key==='d')this.keys.rr =false;
      if(e.key===' '||e.key==='f')         this.keys.shoot=false;
    });
    this._cap('Merlin has the loud stick. Shoot the bad men!',3200);
  }

  _cap(txt,dur){
    this.capEl.textContent=txt; this.capEl.style.opacity='1';
    if(this._capT)clearTimeout(this._capT);
    this._capT=setTimeout(()=>{this.capEl.style.opacity='0';},dur);
  }
  _drawHealth(){
    this.healthEl.innerHTML='';
    for(let i=0;i<5;i++){const s=document.createElement('span');s.textContent=i<this.player.health?'🦴':'💀';this.healthEl.appendChild(s);}
  }

  _touchBtn(lbl,css,dn,up){
    const b=document.createElement('div'); b.style.cssText=css; b.innerHTML=lbl;
    const down=e=>{e.preventDefault();if(dn)dn();};
    const upFn=e=>{e.preventDefault();if(up)up();};
    b.addEventListener('touchstart',down,{passive:false}); b.addEventListener('touchend',upFn,{passive:false}); b.addEventListener('touchcancel',upFn,{passive:false});
    b.addEventListener('mousedown',down); b.addEventListener('mouseup',upFn);
    return b;
  }

  _buildControls(){
    const W=this.W, H=this.H;
    const base='position:absolute;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;border-radius:8px;touch-action:none;background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.26);';
    const BY=H-152, LX=18;

    const dp=(t,l,w,h,lbl,k)=>this._touchBtn(lbl,`${base}top:${BY+t}px;left:${LX+l}px;width:${w}px;height:${h}px;`,
      ()=>this.keys[k]=true,()=>this.keys[k]=false);

    this.root.appendChild(dp(0, 46,46,46,'▲','fwd'));
    this.root.appendChild(dp(94,46,46,46,'▼','back'));
    this.root.appendChild(dp(47,0, 46,46,'◀','rl'));
    this.root.appendChild(dp(47,92,46,46,'▶','rr'));

    const mid=Math.floor(W/2);
    this.root.appendChild(this._touchBtn('↰',`${base}position:absolute;top:${BY+50}px;left:${mid-58}px;width:44px;height:44px;border-radius:50%;`,
      ()=>this.keys.sl=true,()=>this.keys.sl=false));
    this.root.appendChild(this._touchBtn('↱',`${base}position:absolute;top:${BY+50}px;left:${mid+14}px;width:44px;height:44px;border-radius:50%;`,
      ()=>this.keys.sr=true,()=>this.keys.sr=false));

    const SX=W-130;
    this.shootBtn=this._touchBtn('🔫<br>SHOOT',
      `position:absolute;top:${BY+8}px;left:${SX}px;width:112px;height:112px;border-radius:50%;background:rgba(200,30,30,0.85);border:3px solid rgba(255,70,70,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:'Fredoka One',sans-serif;font-size:13px;letter-spacing:1px;box-shadow:0 0 22px rgba(200,30,30,0.45);touch-action:none;`,
      ()=>{this.keys.shoot=true; this.shootBtn.style.background='rgba(255,50,50,0.95)';},
      ()=>{this.keys.shoot=false;this.shootBtn.style.background='rgba(200,30,30,0.85)';}
    );
    this.root.appendChild(this.shootBtn);
  }

  // ── LOOP ──────────────────────────────────
  start(){this.running=true;this.lastTime=performance.now();const L=(now)=>{if(!this.running)return;const dt=Math.min((now-this.lastTime)/1000,0.05);this.lastTime=now;this._update(dt);this._render();this.animFrame=requestAnimationFrame(L);};this.animFrame=requestAnimationFrame(L);}

  _isWall(x,y){const m=0.22;return[[x+m,y+m],[x-m,y+m],[x+m,y-m],[x-m,y-m]].some(([cx,cy])=>{const mx=Math.floor(cx),my=Math.floor(cy);return!this.map[my]||this.map[my][mx]===1;});}

  _update(dt){
    const p=this.player,k=this.keys;
    if(k.rl) p.angle-=p.rotSpeed*60*dt;
    if(k.rr) p.angle+=p.rotSpeed*60*dt;
    let dx=0,dy=0;
    if(k.fwd) {dx+=Math.cos(p.angle)*p.speed*60*dt;dy+=Math.sin(p.angle)*p.speed*60*dt;}
    if(k.back){dx-=Math.cos(p.angle)*p.speed*60*dt;dy-=Math.sin(p.angle)*p.speed*60*dt;}
    if(k.sl)  {dx+=Math.cos(p.angle-Math.PI/2)*p.speed*60*dt;dy+=Math.sin(p.angle-Math.PI/2)*p.speed*60*dt;}
    if(k.sr)  {dx+=Math.cos(p.angle+Math.PI/2)*p.speed*60*dt;dy+=Math.sin(p.angle+Math.PI/2)*p.speed*60*dt;}
    if(!this._isWall(p.x+dx,p.y))p.x+=dx;
    if(!this._isWall(p.x,p.y+dy))p.y+=dy;

    if(this.shootCD>0)this.shootCD-=dt;
    if(k.shoot&&this.shootCD<=0&&p.ammo>0){
      p.ammo--;this.shootCD=0.32;this.ammoEl.textContent='🔫 '+p.ammo;
      Audio.gunshot();this._doShoot();
    }
    if(this.dmgCD>0)this.dmgCD-=dt;

    this.enemies.forEach(e=>{
      if(!e.alive)return;
      const ex=e.x-p.x,ey=e.y-p.y,dist=Math.sqrt(ex*ex+ey*ey);
      e.shootTimer-=dt;
      if(e.shootTimer<=0&&dist<9){
        e.shootTimer=2.2+Math.random()*2;
        if(this.dmgCD<=0&&dist<8){
          p.health=Math.max(0,p.health-1);
          this.dmgCD=1.0;this.flash=0.55;this._drawHealth();Audio.hit();
          if(p.health<=0){this.running=false;setTimeout(()=>this._death(),400);return;}
        }
      }
      if(e.type==='strafe'){
        e.x+=e.sdir*0.012*60*dt;
        if(Math.abs(e.x-8.5)>1.6)e.sdir*=-1;
      } else if(e.type==='advance'&&dist>2.2){
        const spd=0.014,mx=(-ex/dist)*spd*60*dt,my=(-ey/dist)*spd*60*dt;
        if(!this._isWall(e.x+mx,e.y))e.x+=mx;
        if(!this._isWall(e.x,e.y+my))e.y+=my;
      }
      if(e.hitFlash>0)e.hitFlash-=dt*3;
    });

    if(this.flash>0){
      this.flash-=dt*2.2;
      this.flashEl.style.background=`rgba(255,0,0,${Math.max(0,this.flash*0.45)})`;
    }
    if(this.enemies.every(e=>!e.alive)){this.running=false;setTimeout(()=>this._win(),400);}
  }

  _doShoot(){
    const p=this.player;let best=null,bestA=0.14;
    this.enemies.forEach(e=>{
      if(!e.alive)return;
      const dx=e.x-p.x,dy=e.y-p.y;
      let a=Math.atan2(dy,dx)-p.angle;
      while(a>Math.PI)a-=Math.PI*2; while(a<-Math.PI)a+=Math.PI*2;
      if(Math.abs(a)<bestA){bestA=Math.abs(a);best=e;}
    });
    if(best){
      best.health--; best.hitFlash=1.0;
      if(best.health<=0){
        best.alive=false; Audio.boof(0.5);
        const left=this.enemies.filter(e=>e.alive).length;
        const msgs=['All clear! WOOF!','One more! GO MERLIN!','Two down!'];
        this._cap(msgs[left]||'',2000);
      }
    }
  }

  // ── RENDER ────────────────────────────────
  _render(){
    const ctx=this.ctx,W=this.W,H=this.H,p=this.player;
    // Ceiling gradient
    const cg=ctx.createLinearGradient(0,0,0,H/2);
    cg.addColorStop(0,'#040406');cg.addColorStop(1,'#09100a');
    ctx.fillStyle=cg;ctx.fillRect(0,0,W,H/2);
    // Floor gradient
    const fg=ctx.createLinearGradient(0,H/2,0,H);
    fg.addColorStop(0,'#141409');fg.addColorStop(1,'#09090a');
    ctx.fillStyle=fg;ctx.fillRect(0,H/2,W,H/2);

    this.zbuf=new Array(W);
    const hfov=p.fov/2;

    for(let x=0;x<W;x++){
      const ra=p.angle-hfov+(x/W)*p.fov;
      const rdx=Math.cos(ra),rdy=Math.sin(ra);
      let mx=Math.floor(p.x),my=Math.floor(p.y);
      const ddx=rdx===0?1e30:Math.abs(1/rdx),ddy=rdy===0?1e30:Math.abs(1/rdy);
      let sx,sy,sdx,sdy;
      if(rdx<0){sx=-1;sdx=(p.x-mx)*ddx;}else{sx=1;sdx=(mx+1-p.x)*ddx;}
      if(rdy<0){sy=-1;sdy=(p.y-my)*ddy;}else{sy=1;sdy=(my+1-p.y)*ddy;}
      let hit=false,side=0,iter=0;
      while(!hit&&iter++<32){
        if(sdx<sdy){sdx+=ddx;mx+=sx;side=0;}else{sdy+=ddy;my+=sy;side=1;}
        if(this.map[my]&&this.map[my][mx]===1)hit=true;
      }
      let pd=side===0?(mx-p.x+(1-sx)/2)/rdx:(my-p.y+(1-sy)/2)/rdy;
      pd=Math.max(0.01,pd);
      this.zbuf[x]=pd;
      const lh=Math.min(H*2,Math.floor(H/pd));
      const ds=Math.max(0,Math.floor(H/2-lh/2));
      const de=Math.min(H-1,Math.floor(H/2+lh/2));
      let br=Math.max(0,1-pd/10);if(side===1)br*=0.62;
      const r=Math.floor(48*br),g=Math.floor(62*br),b=Math.floor(28*br);
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x,ds,1,de-ds);
      // brick mortar lines
      if(lh>18){
        const wx=side===0?p.y+pd*rdy:p.x+pd*rdx;
        if(Math.floor(wx*7)%2===0){ctx.fillStyle=`rgb(${Math.floor(r*0.65)},${Math.floor(g*0.65)},${Math.floor(b*0.65)})`;ctx.fillRect(x,ds,1,1);ctx.fillRect(x,de-1,1,1);}
      }
    }

    // Render enemy sprites
    const sorted=[...this.enemies].map(e=>{const dx=e.x-p.x,dy=e.y-p.y;return{...e,dx,dy,d2:dx*dx+dy*dy};}).sort((a,b)=>b.d2-a.d2);
    for(const e of sorted){
      if(!e.alive)continue;
      const dist=Math.sqrt(e.d2);
      let sa=Math.atan2(e.dy,e.dx)-p.angle;
      while(sa>Math.PI)sa-=Math.PI*2;while(sa<-Math.PI)sa+=Math.PI*2;
      if(Math.abs(sa)>p.fov*0.7||dist<0.3)continue;
      const sx=Math.floor((0.5+sa/p.fov)*W);
      const sh=Math.min(H*2,Math.floor(H/dist*1.15));
      const sw=Math.floor(sh*0.52);
      const dx0=sx-Math.floor(sw/2),dy0=Math.floor(H/2-sh*0.58);
      const hit=e.hitFlash>0;
      const br=Math.max(0,1-dist/11);
      // Per-column z-buffered draw
      for(let cx=Math.max(0,dx0);cx<Math.min(W,dx0+sw);cx++){
        if(dist>=(this.zbuf[cx]??Infinity))continue;
        const t=(cx-dx0)/sw;
        const headH=Math.floor(sh*0.27),bodyH=Math.floor(sh*0.42),legH=Math.floor(sh*0.31);
        // hat
        if(t>0.1&&t<0.9){ctx.fillStyle=hit?'#882222':'#111111';ctx.fillRect(cx,dy0-Math.floor(sh*0.10),1,Math.floor(sh*0.08));}
        if(t>0.2&&t<0.8){ctx.fillStyle=hit?'#662222':'#0a0a0a';ctx.fillRect(cx,dy0-Math.floor(sh*0.22),1,Math.floor(sh*0.14));}
        // head
        if(t>0.15&&t<0.85){const v=Math.floor(200*br);ctx.fillStyle=hit?`rgb(255,${Math.floor(v*0.5)},${Math.floor(v*0.5)})`:`rgb(${v},${Math.floor(v*0.8)},${Math.floor(v*0.55)})`;ctx.fillRect(cx,dy0,1,headH);}
        // eyes
        if(dist<5&&t>0.25&&t<0.45||t>0.55&&t<0.75){ctx.fillStyle='#FF2222';ctx.fillRect(cx,dy0+Math.floor(headH*0.4),1,Math.floor(headH*0.22));}
        // body
        if(t>0.08&&t<0.92){const v=Math.floor(50*br);ctx.fillStyle=hit?`rgba(180,${Math.floor(v*0.5)},${Math.floor(v*0.5)},1)`:`rgb(${v+10},${v+14},${v})`;ctx.fillRect(cx,dy0+headH,1,bodyH);}
        // legs
        if((t>0.05&&t<0.38)||(t>0.52&&t<0.85)){const v=Math.floor(25*br);ctx.fillStyle=hit?`rgb(${v*2},0,0)`:`rgb(${v},${v},${v})`;ctx.fillRect(cx,dy0+headH+bodyH,1,legH);}
      }
    }

    // Merlin paw + gun at bottom center
    this._renderPaw(ctx,W,H);
  }

  _renderPaw(ctx,W,H){
    const pw=Math.min(W*0.62,238),ph=Math.floor(pw*0.76);
    const cx=W/2,by=H-20;
    // paw pad
    ctx.fillStyle='#111111';ctx.beginPath();ctx.ellipse(cx,by,pw/2,ph*0.44,0,0,Math.PI*2);ctx.fill();
    // toe beans
    [-0.36,-0.13,0.13,0.36].forEach(o=>{ctx.fillStyle='#0c0c0c';ctx.beginPath();ctx.ellipse(cx+o*pw,by-ph*0.44,pw*0.088,pw*0.11,0,0,Math.PI*2);ctx.fill();});
    // main pad
    ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.ellipse(cx+18,by-10,pw*0.26,ph*0.26,0.18,0,Math.PI*2);ctx.fill();
    // 1911 pistol
    const gx=cx-28,gy=by-ph*0.54;
    ctx.fillStyle='#555';ctx.fillRect(gx+58,gy+18,54,11);   // barrel
    ctx.fillStyle='#3A3A3A';                                   // slide
    ctx.beginPath();ctx.moveTo(gx+4,gy+14);ctx.lineTo(gx+116,gy+14);ctx.lineTo(gx+116,gy+36);ctx.lineTo(gx+4,gy+36);ctx.closePath();ctx.fill();
    ctx.fillStyle='#2A2A2A';                                   // grip
    ctx.beginPath();ctx.moveTo(gx+6,gy+34);ctx.lineTo(gx+44,gy+34);ctx.lineTo(gx+40,gy+86);ctx.lineTo(gx+2,gy+86);ctx.closePath();ctx.fill();
    ctx.fillStyle='#1a1a1a'; for(let gi=0;gi<5;gi++)ctx.fillRect(gx+8,gy+40+gi*8,32,4); // grip serrations
    ctx.fillStyle='#555';ctx.fillRect(gx+40,gy+26,3,22);     // trigger
    ctx.fillRect(gx+113,gy+12,5,7);                           // front sight
    ctx.fillRect(gx+6,gy+12,4,7);                             // rear sight
  }

  _death(){
    cancelAnimationFrame(this.animFrame);
    const ov=document.createElement('div');
    ov.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.88);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;';
    ov.innerHTML=`<div style="font-size:52px;margin-bottom:8px">💀</div>
      <div style="font-family:'Fredoka One',sans-serif;font-size:28px;color:#CC2222;margin-bottom:10px">MERLIN IS DOWN</div>
      <div style="font-family:Nunito,sans-serif;font-size:15px;color:#F0EAD8;padding:0 30px;line-height:1.6">"Merlin got the loud stick and then the loud stick got Merlin. This is a lesson about loud sticks."</div>
      <button id="fps-retry" style="margin-top:24px;padding:14px 42px;background:#D4A843;color:#111;border:none;font-family:'Fredoka One',sans-serif;font-size:20px;border-radius:8px;cursor:pointer;">TRY AGAIN</button>`;
    this.root.appendChild(ov);
    document.getElementById('fps-retry').addEventListener('click',()=>{this.destroy();if(this.onLose)this.onLose();});
  }

  _win(){
    cancelAnimationFrame(this.animFrame);Audio.fanfare();
    const ov=document.createElement('div');
    ov.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.88);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;';
    ov.innerHTML=`<div style="font-size:52px;margin-bottom:8px">🦴</div>
      <div style="font-family:'Fredoka One',sans-serif;font-size:28px;color:#D4A843;margin-bottom:10px">MERLIN WINS!</div>
      <div style="font-family:Nunito,sans-serif;font-size:15px;color:#F0EAD8;padding:0 30px;line-height:1.6">"Merlin got all the bad men. Merlin does not want the loud stick anymore. Adventure is so much."</div>
      <button id="fps-win" style="margin-top:24px;padding:14px 42px;background:#D4A843;color:#111;border:none;font-family:'Fredoka One',sans-serif;font-size:20px;border-radius:8px;cursor:pointer;">CONTINUE →</button>`;
    this.root.appendChild(ov);
    document.getElementById('fps-win').addEventListener('click',()=>{this.destroy();if(this.onWin)this.onWin();});
  }

  destroy(){
    this.running=false;
    if(this.animFrame)cancelAnimationFrame(this.animFrame);
    window.removeEventListener('keydown',this._kd);window.removeEventListener('keyup',this._ku);
    if(this.root&&this.root.parentNode)this.root.parentNode.removeChild(this.root);
  }
}

// ── CH1 FPS BRIDGE SCENE ───────────────────────────────────────────────────
class Ch1FPSScene extends Phaser.Scene {
  constructor(){super('Ch1FPSScene');}
  create(){
    this.game.canvas.style.display='none';
    this._launch();
  }
  _launch(){
    const fps=new MerlinFPS(
      ()=>{this.game.canvas.style.display='block';this._afterWin();},
      ()=>{fps.destroy();this._launch();}  // retry: relaunch
    );
    fps.start();
  }
  _afterWin(){
    const W=this.scale.width,H=this.scale.height;
    this.cameras.main.setBackgroundColor('#0a0a18').fadeIn(400);
    this.add.sprite(W/2,H-165,'merlin-sit').setScale(1.35);
    const dlg=new Dialogue(this);
    dlg.show([
      {speaker:'Merlin',text:'Merlin does not want the loud stick anymore.'},
      {speaker:'Merlin',text:'Adventure is so much.'},
      {speaker:'Merlin',text:'Merlin deserves a drink.'},
    ],()=>{
      titleCard(this,'CHAPTER 2','"MERLIN GOES TO THE BAR"',()=>{
        this.cameras.main.fadeOut(400);
        this.time.delayedCall(400,()=>this.scene.start('Ch2IntroScene'));
      });
    });
  }
}

// ── STUB SCENE (Ch2–5 placeholder) ────────────────────────────────────────
class StubScene extends Phaser.Scene {
  constructor(){super('StubScene');}
  create(){
    const W=this.scale.width,H=this.scale.height;
    this.cameras.main.setBackgroundColor('#0a0a12').fadeIn(400);
    this.add.sprite(W/2,H/2-50,'merlin-sit').setScale(1.45);
    this.add.text(W/2,H/2+80,'CHAPTERS 2–5',{fontSize:'20px',color:'#D4A843',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5);
    this.add.text(W/2,H/2+116,'COMING SOON',{fontSize:'28px',color:'#F0EAD8',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5);
    this.add.text(W/2,H/2+162,'Merlin is resting up.\nHe is a very tired and good boy.',{fontSize:'14px',color:'#A09070',fontFamily:'Nunito,sans-serif',align:'center',lineSpacing:5}).setOrigin(0.5);
    const r=this.add.text(W/2,H-72,'TAP TO PLAY AGAIN',{fontSize:'16px',color:'#D4A843',fontFamily:'Fredoka One,sans-serif',letterSpacing:4}).setOrigin(0.5);
    this.tweens.add({targets:r,alpha:0.15,duration:680,yoyo:true,repeat:-1});
    this.input.once('pointerdown',()=>{this.cameras.main.fadeOut(400);this.time.delayedCall(400,()=>this.scene.start('BootScene'));});
  }
}

// [INIT REPLACED]

// ── CHAPTER 2 INTRO SCENE (Bar entrance + bartender choice) ───────────────
class Ch2IntroScene extends Phaser.Scene {
  constructor(){super('Ch2IntroScene');}
  create(){
    this.cameras.main.fadeIn(500);
    const W=this.scale.width,H=this.scale.height;
    this._buildBar(W,H);
    this.merlin=this.add.sprite(-80,H-162,'merlin-w1').setFlipX(true).setDepth(10);
    this.dlg=new Dialogue(this);
    this.time.delayedCall(400,()=>this._enter());
  }

  _buildBar(W,H){
    // Background: warm amber bar interior
    this.add.rectangle(W/2,H/2,W,H,0x1a0e06);
    // Back wall (dark wood paneling)
    this.add.rectangle(W/2,H/2-60,W,H*0.55,0x2a1a0a);
    // Shelf unit
    this.add.rectangle(W/2,H/2-130,W,8,0x4a2a0a);
    this.add.rectangle(W/2,H/2-90,W,6,0x4a2a0a);
    // Neon sign
    const neon=this.add.text(W/2,H/2-160,"BAR",{fontSize:'28px',color:'#FF4466',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5).setDepth(2);
    this.tweens.add({targets:neon,alpha:0.55,duration:800,yoyo:true,repeat:-1});
    // Bottles on shelf (decorative rects)
    const bottles=[
      [0x884400,10,40],[0xAA6600,8,35],[0x224488,10,38],[0x22AA44,9,32],
      [0xAA2222,8,36],[0x884400,10,30],[0xDDDD22,8,34],[0x663388,10,38],[0x224488,9,35],[0x22AA44,10,32]
    ];
    bottles.forEach(([c,w,h],i)=>{
      this.add.rectangle(28+i*(W-20)/10,H/2-118,w,h,c).setDepth(3);
      this.add.rectangle(28+i*(W-20)/10,H/2-120,w+4,4,0x888888,0.5).setDepth(3);
    });
    // Bar counter (foreground) — thick dark wood slab
    this.add.rectangle(W/2,H-88,W+10,90,0x3a2010).setDepth(8);
    this.add.rectangle(W/2,H-128,W+10,8,0x5a3820).setDepth(8); // counter top
    this.add.rectangle(W/2,H-126,W+10,4,0x7a5030,0.7).setDepth(9); // bar edge highlight
    // Bar stools
    [60,W/2,W-60].forEach(x=>{
      this.add.rectangle(x,H-148,30,6,0x5a3820).setDepth(7);
      this.add.rectangle(x,H-135,6,28,0x3a2010).setDepth(7);
    });
    // Warm ambient light pools on floor
    this.add.ellipse(W/2,H-80,200,30,0xFFAA44,0.07).setDepth(0);
    // Floor
    this.add.rectangle(W/2,H-52,W,105,0x120a04).setDepth(0);
    // Puddle of... something
    this.add.ellipse(W/3,H-110,50,12,0xAA8822,0.4).setDepth(1);
  }

  _enter(){
    const W=this.scale.width,H=this.scale.height; let f=0;
    // Bartender takes position
    this.barkeep=this.add.sprite(W/2+80,H-200,'bartender').setDepth(9).setScale(1.1);
    this.tweens.add({targets:this.merlin,x:W/2-80,duration:1500,ease:'Linear',
      onUpdate:()=>{f++;this.merlin.setTexture(f%14<7?'merlin-w1':'merlin-w2');},
      onComplete:()=>{
        this.merlin.setTexture('merlin-idle');
        this.dlg.show([
          {speaker:'Merlin',text:'A bar. Merlin has seen bars on TV. The Boys watch the game sometimes.'},
          {speaker:'Merlin',text:'Merlin is going to get a drink. This is what adventure looks like.'},
          {speaker:'Bartender',text:"We don't... serve dogs."},
        ],()=>this._choice());
      }});
  }

  _choice(){
    const W=this.scale.width,H=this.scale.height;
    // Show choice buttons
    const opts=[
      {label:'[Merlin sits and looks very cute]',good:true},
      {label:'[Merlin puts paw on bar]',         good:true},
      {label:'[Merlin lets out one loud BOOF]',  good:false},
    ];
    this._btns=[];
    opts.forEach((opt,i)=>{
      const bg=this.add.rectangle(W/2,H-320+i*64,W-40,52,0x1a1008,0.92).setDepth(210).setInteractive();
      bg.setStrokeStyle(1,0xD4A843,0.6);
      const txt=this.add.text(W/2,H-320+i*64,opt.label,{fontSize:'13px',color:'#F0EAD8',fontFamily:'Nunito,sans-serif',align:'center',wordWrap:{width:W-60}}).setOrigin(0.5).setDepth(211);
      bg.on('pointerdown',()=>{
        this._btns.forEach(([b,t])=>{b.destroy();t.destroy();});
        if(opt.good){
          const reaction=i===0?'...fine. One drink.':"Did that dog just— okay. Fine.";
          this.dlg.show([
            {speaker:'Bartender',text:reaction},
            {speaker:'Merlin',text:'Merlin is very good at sitting. This is a known fact.'},
          ],()=>{
            this.cameras.main.fadeOut(400);
            this.time.delayedCall(400,()=>this.scene.start('Ch2DrinkScene'));
          });
        } else {
          Audio.boof(1.2);
          this.cameras.main.shake(300,0.008);
          // Auto-dismiss — no taps required, cannot get stuck
          const W2=this.scale.width,H2=this.scale.height;
          const t1=this.add.text(W2/2,H2/2-30,'ANIMAL CONTROL CALLED',{fontSize:'22px',color:'#CC2222',fontFamily:'Fredoka One,sans-serif',backgroundColor:'#000000CC',padding:{x:14,y:10}}).setOrigin(0.5).setDepth(300).setAlpha(0);
          const t2=this.add.text(W2/2,H2/2+22,'"Merlin made a mistake."',{fontSize:'15px',color:'#F0EAD8',fontFamily:'Nunito,sans-serif',backgroundColor:'#000000CC',padding:{x:10,y:6}}).setOrigin(0.5).setDepth(300).setAlpha(0);
          this.tweens.add({targets:[t1,t2],alpha:1,duration:250});
          Audio.slideDown();
          this.time.delayedCall(2200,()=>{
            this.cameras.main.fadeOut(400);
            this.time.delayedCall(400,()=>this.scene.restart());
          });
        }
      });
      bg.on('pointerover', ()=>{ bg.setFillStyle(0x2a2010,0.95); txt.setColor('#D4A843'); });
      bg.on('pointerout',  ()=>{ bg.setFillStyle(0x1a1008,0.92); txt.setColor('#F0EAD8'); });
      this._btns.push([bg,txt]);
    });
  }
}

// ── CHAPTER 2 DRINK SCENE ─────────────────────────────────────────────────
class Ch2DrinkScene extends Phaser.Scene {
  constructor(){super('Ch2DrinkScene');}
  create(){
    this.cameras.main.fadeIn(400);
    const W=this.scale.width,H=this.scale.height;
    this._buildBar(W,H);
    this.merlin=this.add.sprite(W/2-80,H-162,'merlin-sit').setDepth(10).setScale(1.1);
    // Sequence state
    this.correctOrder=['beer','whiskey','vodka','tequila'];
    this.currentIdx=0;
    this.dlg=new Dialogue(this);
    // Dialogue finishes FIRST, then buttons appear — prevents input conflict
    this.dlg.show([
      {speaker:'Bartender',text:'What are you having?'},
      {speaker:'Merlin',  text:'Merlin will have... one of each. In the correct order. Merlin knows about orders.'},
      {speaker:'Merlin',  text:'Tap the drinks in the right order. This is a test of character.'},
    ],()=>this._showDrinks());
  }

  _buildBar(W,H){
    this.add.rectangle(W/2,H/2,W,H,0x1a0e06);
    this.add.rectangle(W/2,H/2-60,W,H*0.55,0x2a1a0a);
    this.add.rectangle(W/2,H/2-130,W,8,0x4a2a0a);
    this.add.rectangle(W/2,H/2-90,W,6,0x4a2a0a);
    const neon=this.add.text(W/2,H/2-160,'BAR',{fontSize:'28px',color:'#FF4466',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5).setDepth(2);
    this.tweens.add({targets:neon,alpha:0.55,duration:800,yoyo:true,repeat:-1});
    const bottles=[[0x884400,10,40],[0xAA6600,8,35],[0x224488,10,38],[0x22AA44,9,32],[0xAA2222,8,36],[0x884400,10,30],[0xDDDD22,8,34],[0x663388,10,38],[0x224488,9,35],[0x22AA44,10,32]];
    bottles.forEach(([c,w,h],i)=>{this.add.rectangle(28+i*(W-20)/10,H/2-118,w,h,c).setDepth(3);});
    this.add.rectangle(W/2,H-88,W+10,90,0x3a2010).setDepth(8);
    this.add.rectangle(W/2,H-128,W+10,8,0x5a3820).setDepth(8);
    this.add.rectangle(W/2,H-126,W+10,4,0x7a5030,0.7).setDepth(9);
    this.add.rectangle(W/2,H-52,W,105,0x120a04).setDepth(0);
    // Barkeep behind counter
    this.add.sprite(W/2+100,H-200,'bartender').setDepth(9).setScale(1.1);
  }

  _showDrinks(){
    const W=this.scale.width,H=this.scale.height;
    const drinks=[
      {id:'beer',    label:'🍺 Beer',    color:0xCC8800,liquid:0xDDAA00,desc:'Cold and golden'},
      {id:'whiskey', label:'🥃 Whiskey', color:0x7A3800,liquid:0xAA5500,desc:'Dark and smoky'},
      {id:'vodka',   label:'🍸 Vodka',   color:0x334466,liquid:0x99CCEE,desc:'Clear and cold'},
      {id:'tequila', label:'🍹 Tequila', color:0x887700,liquid:0xDDCC22,desc:'Lime not included'},
    ];

    // Buttons positioned in UPPER half — well above dialogue panel (H-155)
    // Row 0 center: H-390, Row 1 center: H-295
    this.add.text(W/2,H-430,'Tap in the right order:',{fontSize:'12px',color:'#A09070',fontFamily:'Nunito,sans-serif'}).setOrigin(0.5).setDepth(12);

    // Progress pips
    this.pips=[];
    drinks.forEach((_,i)=>{
      this.pips.push(this.add.circle(W/2-45+i*30,H-414,7,0x333333).setDepth(12).setStrokeStyle(2,0x666666));
    });

    this._drinkBtns=[];
    drinks.forEach((d,i)=>{
      const col=i%2, row=Math.floor(i/2);
      const bx=W/4+col*(W/2);
      const by=H-390+row*100;   // row 0: H-390=310, row 1: H-290=410 — safely above panel

      const bg=this.add.rectangle(bx,by,W/2-28,86,0x111111,0.92).setDepth(11).setInteractive().setStrokeStyle(2,d.color,0.6);
      const liq=this.add.rectangle(bx,by+14,W/2-40,36,d.liquid,0.8).setDepth(12);
      if(d.id==='beer')this.add.rectangle(bx,by-5,W/2-40,12,0xFFFFEE,0.85).setDepth(13);
      const lbl=this.add.text(bx,by-30,d.label,{fontSize:'15px',color:'#F0EAD8',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5).setDepth(13);
      const sub=this.add.text(bx,by+30,d.desc,{fontSize:'10px',color:'#888866',fontFamily:'Nunito,sans-serif'}).setOrigin(0.5).setDepth(13);

      bg.on('pointerover',()=>{bg.setStrokeStyle(3,d.color,1);lbl.setColor('#D4A843');});
      bg.on('pointerout', ()=>{bg.setStrokeStyle(2,d.color,0.6);lbl.setColor('#F0EAD8');});
      bg.on('pointerdown',()=>this._onDrinkTap(d.id,bg,liq,lbl,i));

      this._drinkBtns.push({bg,liq,lbl,sub,id:d.id,color:d.color});
    });
  }

  _resetDrinks(){
    this.currentIdx=0;
    this.pips.forEach(p=>p.setFillStyle(0x333333).setStrokeStyle(2,0x666666));
    this._drinkBtns.forEach(b=>{
      b.bg.setInteractive();
      b.bg.setStrokeStyle(2,b.color,0.6);
      b.liq.setAlpha(0.8);
    });
  }

  _onDrinkTap(id,bg,liq,lbl,idx){
    if(id===this.correctOrder[this.currentIdx]){
      // Correct — flash green, disable button, show floating toast (no dialogue conflict)
      bg.setStrokeStyle(3,0x44FF44,1);
      this.pips[this.currentIdx].setFillStyle(0xD4A843).setStrokeStyle(2,0xFFD700);
      bg.disableInteractive();
      liq.setAlpha(0.3);

      const reactions=[
        'Oh. OH. This is what happy tastes like.',
        'Spicy water. Merlin respects it.',
        'Nothing. And then everything.',
        'This one is a mistake and Merlin wants another.',
      ];
      // Floating toast — no tap required, fades on its own
      const W=this.scale.width, H=this.scale.height;
      const toast=this.add.text(W/2,H-175,reactions[this.currentIdx],{
        fontSize:'13px',color:'#F0EAD8',fontFamily:'Nunito,sans-serif',
        backgroundColor:'#00000099',padding:{x:10,y:6},align:'center',wordWrap:{width:280}
      }).setOrigin(0.5).setDepth(220).setAlpha(0);
      this.tweens.add({targets:toast,alpha:1,duration:200,
        onComplete:()=>this.tweens.add({targets:toast,alpha:0,duration:500,delay:1800,onComplete:()=>toast.destroy()})});

      this.currentIdx++;

      if(this.currentIdx>=4){
        this._drinkBtns.forEach(b=>b.bg.disableInteractive());
        this.time.delayedCall(1200,()=>{
          this.cameras.main.fadeOut(450);
          this.time.delayedCall(450,()=>this.scene.start('Ch2DrunkScene'));
        });
      }
    } else {
      // Wrong order — flash Merlin red, reset buttons in-place, player tries again
      this._drinkBtns.forEach(b=>b.bg.disableInteractive());
      this.cameras.main.shake(280,0.012);
      Audio.slideDown();
      // Flash Merlin
      let flashes=0;
      const flashTimer=this.time.addEvent({delay:120,repeat:5,callback:()=>{
        flashes++;
        this.merlin.setTint(flashes%2===0?0xFF4444:0xFFFFFF);
        if(flashes>=6)this.merlin.clearTint();
      }});
      // Brief message
      const W2=this.scale.width,H2=this.scale.height;
      const msg=this.add.text(W2/2,H2/2-10,'Wrong order!\nTry again from the start.',{fontSize:'18px',color:'#F0EAD8',fontFamily:'Fredoka One,sans-serif',align:'center',backgroundColor:'#000000BB',padding:{x:14,y:10}}).setOrigin(0.5).setDepth(302).setAlpha(0);
      this.tweens.add({targets:msg,alpha:1,duration:200});
      this.time.delayedCall(1800,()=>{
        this.tweens.add({targets:msg,alpha:0,duration:200,onComplete:()=>msg.destroy()});
        this._resetDrinks();
      });
    }
  }
}

// ── CHAPTER 2 DRUNK SCENE ─────────────────────────────────────────────────
class Ch2DrunkScene extends Phaser.Scene {
  constructor(){super('Ch2DrunkScene');}
  create(){
    this.cameras.main.fadeIn(600);
    const W=this.scale.width,H=this.scale.height;
    this._buildBar(W,H);
    this.merlin=this.add.sprite(W/2-60,H-162,'merlin-happy').setDepth(10).setScale(1.1);
    // Drunk wobble — continuous camera rotation and zoom pulse
    this._wobble();
    // Color haze overlay
    this.haze=this.add.rectangle(W/2,H/2,W,H,0xAA6600,0.08).setDepth(300);
    this.dlg=new Dialogue(this);
    this.time.delayedCall(600,()=>this._drunkEnter());
  }

  _buildBar(W,H){
    this.add.rectangle(W/2,H/2,W,H,0x1a0e06);
    this.add.rectangle(W/2,H/2-60,W,H*0.55,0x2a1a0a);
    this.add.rectangle(W/2,H/2-130,W,8,0x4a2a0a);
    this.add.rectangle(W/2,H/2-90,W,6,0x4a2a0a);
    const neon=this.add.text(W/2,H/2-160,'BAR',{fontSize:'28px',color:'#FF4466',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5).setDepth(2);
    this.tweens.add({targets:neon,alpha:0.4,duration:600,yoyo:true,repeat:-1});
    this.add.rectangle(W/2,H-88,W+10,90,0x3a2010).setDepth(8);
    this.add.rectangle(W/2,H-128,W+10,8,0x5a3820).setDepth(8);
    this.add.rectangle(W/2,H-126,W+10,4,0x7a5030,0.7).setDepth(9);
    this.add.rectangle(W/2,H-52,W,105,0x120a04).setDepth(0);
    this.add.sprite(W/2+100,H-200,'bartender').setDepth(9).setScale(1.1);
  }

  _wobble(){
    // Oscillating camera rotation + zoom to simulate drunk
    this._wobbleEvent=this.time.addEvent({delay:16,repeat:-1,callback:()=>{
      const t=this.time.now;
      this.cameras.main.setRotation(Math.sin(t/420)*0.028);
      this.cameras.main.setZoom(1+Math.sin(t/650)*0.022);
      // Haze pulse
      if(this.haze)this.haze.setAlpha(0.06+Math.sin(t/800)*0.04);
    }});
  }

  _drunkEnter(){
    const W=this.scale.width,H=this.scale.height;
    this.dlg.show([
      {speaker:'Merlin',text:'Merlin feels... larger. Also smaller. Both things.'},
      {speaker:'Merlin',text:'The bar is very nice. Everything is a little sideways. That is okay.'},
    ],()=>{
      // Lady enters from right
      this.lady=this.add.sprite(W+60,H-190,'lady').setDepth(10).setScale(1.1);
      this.tweens.add({targets:this.lady,x:W/2+100,duration:900,ease:'Power2',
        onComplete:()=>this._ladyDialogue()});
    });
  }

  _ladyDialogue(){
    this.dlg.show([
      {speaker:'Lady',  text:'Hey big boy. You want a good time?'},
      {speaker:'Merlin',text:'A good time. YES. Merlin loves good times.'},
      {speaker:'Merlin',text:'Is this cuddles? This feels like a cuddle offer. Merlin LOVES cuddles.'},
      {speaker:'Lady',  text:"It'll cost you."},
      {speaker:'Merlin',text:'Cost. Merlin does not have money. Merlin has love. And one sock at home.'},
      {speaker:'Merlin',text:'She does not seem to want those things.'},
      {speaker:'Merlin',text:'Merlin is leaving now. Very fast.'},
    ],()=>this._bolt());
  }

  _bolt(){
    const W=this.scale.width,H=this.scale.height;
    // Stop wobble, clear rotation for the bolt animation
    if(this._wobbleEvent)this._wobbleEvent.remove();
    this.cameras.main.setRotation(0).setZoom(1);
    Audio.boof(1.4);
    this.cameras.main.shake(200,0.01);

    // Merlin sprints out — exaggerated drunk sprint
    let f=0,wobbleDir=1;
    this.tweens.add({targets:this.merlin,x:W+100,y:H-155,duration:900,ease:'Power2',
      onUpdate:()=>{
        f++;
        this.merlin.setTexture(f%8<4?'merlin-w1':'merlin-w2');
        this.merlin.y=H-162+Math.sin(f*0.8)*12*wobbleDir;
      },
      onComplete:()=>{
        this.dlg.show([
          {speaker:'Bartender',text:"HEY! You didn't pay! And I don't have a tab system for dogs!"},
          {speaker:'Merlin',  text:'Merlin is already outside. Merlin is very sorry. Merlin is also still moving.'},
        ],()=>{
          titleCard(this,'CHAPTER 3','"MERLIN TRIES KETAMINE"',()=>{
            this.cameras.main.fadeOut(400);
            this.time.delayedCall(400,()=>this.scene.start('Ch3IntroScene'));
          });
        });
      }
    });
  }
}

// [INIT PLACEHOLDER]

// ── CHAPTER 3 INTRO SCENE ─────────────────────────────────────────────────
class Ch3IntroScene extends Phaser.Scene {
  constructor(){super('Ch3IntroScene');}

  create(){
    this.cameras.main.fadeIn(500);
    const W=this.scale.width,H=this.scale.height;
    this._buildStreet(W,H);
    this.merlin=this.add.sprite(-80,H-160,'merlin-w1').setFlipX(true).setDepth(10);
    this.dlg=new Dialogue(this);
    this.time.delayedCall(400,()=>this._enter());
  }

  _makeTextures(){
    const s=this;
    function make(key,w,h,fn){const g=s.make.graphics({x:0,y:0,add:false});fn(g);g.generateTexture(key,w,h);g.destroy();}

    // Sketchy guy — gaunt, hoodie, shifty
    make('sketchy',72,148,g=>{
      // Shoes
      g.fillStyle(0x111111,1);g.fillRoundedRect(10,130,22,16,3);g.fillRoundedRect(40,130,22,16,3);
      // Pants (dirty grey)
      g.fillStyle(0x444440,1);g.fillRoundedRect(14,88,44,48,4);
      // Hoodie body (dark, baggy)
      g.fillStyle(0x222228,1);g.fillRoundedRect(8,44,56,50,5);
      // Hoodie arms (long, droopy)
      g.fillStyle(0x1e1e24,1);g.fillRoundedRect(0,46,12,52,5);g.fillRoundedRect(60,46,12,52,5);
      // Hands poking out
      g.fillStyle(0xC0A080,1);g.fillCircle(6,97,6);g.fillCircle(66,97,6);
      // Neck
      g.fillStyle(0xC0A080,1);g.fillRect(30,36,12,14);
      // Head (gaunt)
      g.fillStyle(0xC0A080,1);g.fillEllipse(36,25,34,36);
      // Hood pulled low
      g.fillStyle(0x1a1a20,1);g.fillEllipse(36,16,44,28);
      g.fillEllipse(36,24,46,20);
      // Shadowed eyes (barely visible under hood)
      g.fillStyle(0x080808,1);g.fillRect(22,22,10,5);g.fillRect(40,22,10,5);
      g.fillStyle(0xFF4444,0.7);g.fillCircle(27,24,3);g.fillCircle(45,24,3);
      // Smirk
      g.lineStyle(2,0xC0A080,1);g.beginPath();g.arc(36,34,6,0.3,Math.PI*0.8);g.strokePath();
    });

    // Ketamine clinic vending machine
    make('vending',100,180,g=>{
      // Cabinet
      g.fillStyle(0xDDEEFF,1);g.fillRoundedRect(0,0,100,180,6);
      g.fillStyle(0xBBCCDD,1);g.fillRoundedRect(3,3,94,174,5);
      // Screen
      g.fillStyle(0x88AACC,1);g.fillRoundedRect(10,10,80,60,4);
      g.fillStyle(0xAADDFF,1);g.fillRoundedRect(12,12,76,56,3);
      g.fillStyle(0x224488,1);
      g.fillText && g.fillText('K+WELLNESS',14,38);
      // Display text via rectangle placeholder
      g.fillStyle(0x224488,0.8);g.fillRect(14,22,50,6);g.fillRect(14,32,38,5);g.fillRect(14,42,44,4);
      // Coin slot
      g.fillStyle(0x334455,1);g.fillRoundedRect(35,78,30,10,3);
      g.fillStyle(0x111122,1);g.fillRect(44,80,12,6);
      // Coin slot label
      g.fillStyle(0x556677,1);g.fillRect(20,82,14,4);g.fillRect(66,82,14,4);
      // Item grid (3x2 slots)
      for(let r=0;r<2;r++) for(let c=0;c<3;c++){
        g.fillStyle(0xCCDDEE,1);g.fillRoundedRect(8+c*30,96+r*36,26,32,3);
        g.fillStyle(0xFFFFFF,0.6);g.fillRoundedRect(10+c*30,98+r*36,22,18,2);
      }
      // Dispense tray
      g.fillStyle(0x8899AA,1);g.fillRoundedRect(8,168,84,10,3);
      g.fillStyle(0x667788,1);g.fillRect(12,169,76,5);
    });

    // Token / coin
    make('token',40,40,g=>{
      g.fillStyle(0xCCBB00,1);g.fillCircle(20,20,18);
      g.fillStyle(0xDDCC11,1);g.fillCircle(20,20,15);
      g.fillStyle(0xAA9900,1);g.fillCircle(20,20,10);
      g.fillStyle(0xDDCC11,1);g.fillRect(17,12,6,16);g.fillRect(12,17,16,6);
    });

    // Ketamine packet (small white envelope/sachet)
    make('packet',50,30,g=>{
      g.fillStyle(0xEEEEEE,1);g.fillRoundedRect(0,0,50,30,4);
      g.fillStyle(0xCCCCCC,1);g.fillRect(0,14,50,2);
      g.lineStyle(1,0xAAAAAA,0.8);g.strokeRect(2,2,46,26);
      // "K+" label
      g.fillStyle(0x3355AA,1);g.fillRect(8,6,34,8);
      g.fillStyle(0xFFFFFF,0.9);g.fillRect(10,8,8,4);g.fillRect(26,8,12,4);
      // Tear notch
      g.fillStyle(0xDDDDDD,1);g.fillTriangle(0,0,8,0,0,8);
    });

    // Couch for balance game
    make('couch',220,100,g=>{
      // Frame / base
      g.fillStyle(0x7A5A3A,1);g.fillRoundedRect(0,50,220,50,8);
      // Cushions
      g.fillStyle(0x9A7A5A,1);g.fillRoundedRect(4,30,102,50,6);g.fillRoundedRect(114,30,102,50,6);
      // Cushion seam
      g.lineStyle(2,0x7A5A3A,0.5);g.lineBetween(110,32,110,78);
      // Top backrest
      g.fillStyle(0x8A6A4A,1);g.fillRoundedRect(0,18,220,22,6);
      // Armrests
      g.fillStyle(0x6A4A2A,1);g.fillRoundedRect(0,18,24,70,5);g.fillRoundedRect(196,18,24,70,5);
      // Legs
      g.fillStyle(0x3A2010,1);g.fillRect(8,92,16,8);g.fillRect(196,92,16,8);
    });
  }

  _buildStreet(W,H){
    // Night — similar to Ch1 but different area, clinic in BG
    this.add.rectangle(W/2,H/2,W,H,0x070710);
    // Stars
    for(let i=0;i<35;i++) this.add.circle(Phaser.Math.Between(0,W),Phaser.Math.Between(0,H*0.35),Phaser.Math.Between(1,2),0xFFFFFF,Phaser.Math.FloatBetween(0.2,0.9));
    // Building behind — clean clinical white
    this.add.rectangle(W/2,H/2-40,W*0.8,260,0xDDEEFF,0.9);
    this.add.rectangle(W/2,H/2-40,W*0.8-4,256,0xEEF5FF,0.95);
    // Clinic sign (neon-ish)
    const sign=this.add.text(W/2,H/2-140,'MADISON KETAMINE\nWELLNESS CLINIC',{fontSize:'13px',color:'#88AAFF',fontFamily:'Fredoka One,sans-serif',align:'center'}).setOrigin(0.5).setDepth(3);
    this.add.text(W/2,H/2-108,'Walk-Ins Welcome',{fontSize:'10px',color:'#AACCFF',fontFamily:'Nunito,sans-serif',align:'center'}).setOrigin(0.5).setDepth(3);
    this.tweens.add({targets:sign,alpha:0.6,duration:900,yoyo:true,repeat:-1});
    // Clinic door
    this.add.rectangle(W/2,H-168,55,120,0x8899BB).setDepth(4);
    this.add.rectangle(W/2,H-168,51,116,0xAABBDD,0.9).setDepth(5);
    this.add.circle(W/2+20,H-168,5,0xCCDDEE).setDepth(6);
    // Windows
    [-90,90].forEach(ox=>{
      this.add.rectangle(W/2+ox,H/2-80,60,70,0xAABBDD,0.8).setDepth(3);
      this.add.rectangle(W/2+ox,H/2-80,56,66,0xBBCCEE,0.6).setDepth(3);
    });
    // Sidewalk
    this.add.rectangle(W/2,H-80,W,160,0x14141C).setDepth(0);
    this.add.rectangle(W/2,H-128,W,4,0x222230,0.8);
    // Vending machine outside (right of door)
    this.vendingSprite=this.add.sprite(W/2+100,H-195,'vending').setDepth(5).setScale(0.9);
  }

  _enter(){
    const W=this.scale.width,H=this.scale.height; let f=0;
    // Sketchy guy already leaning on wall
    this.sketchy=this.add.sprite(W/2-60,H-175,'sketchy').setDepth(8);
    this.tweens.add({targets:this.merlin,x:W/2-155,duration:1600,ease:'Linear',
      onUpdate:()=>{f++;this.merlin.setTexture(f%14<7?'merlin-w1':'merlin-w2');},
      onComplete:()=>{
        this.merlin.setTexture('merlin-idle');
        this.dlg.show([
          {speaker:'Merlin',text:'Outside smells like many things. This block smells like... clean? And also something else.'},
          {speaker:'Merlin',text:'That man is leaning in a suspicious way. Merlin finds this interesting.'},
        ],()=>this._sketchyApproach());
      }});
  }

  _sketchyApproach(){
    const W=this.scale.width,H=this.scale.height;
    this.tweens.add({targets:this.sketchy,x:W/2-100,duration:700,ease:'Power2',
      onComplete:()=>{
        this.dlg.show([
          {speaker:'Sketchy Guy',text:'Hey. Dog. You look stressed.'},
          {speaker:'Merlin',    text:'Merlin is not stressed. Merlin is on an adventure. There is a difference.'},
          {speaker:'Sketchy Guy',text:'We got something for that. Come on in. Walk-ins welcome.'},
          {speaker:'Merlin',    text:'This man is being so helpful. Merlin loves helpful men.'},
          {speaker:'Merlin',    text:'Except the ones with the loud sticks. This man has no loud stick.'},
          {speaker:'Merlin',    text:'Merlin is going in.'},
        ],()=>this._enter2());
      }});
  }

  _enter2(){
    const W=this.scale.width,H=this.scale.height; let f=0;
    // Both walk toward door
    this.tweens.add({targets:this.merlin, x:W/2-10,duration:900,ease:'Linear',
      onUpdate:()=>{f++;this.merlin.setTexture(f%14<7?'merlin-w1':'merlin-w2');}});
    this.tweens.add({targets:this.sketchy,x:W/2+20,duration:900,ease:'Linear',
      onComplete:()=>{
        this.cameras.main.fadeOut(500);
        this.time.delayedCall(500,()=>this.scene.start('Ch3PuzzleScene'));
      }});
  }
}

// ── CHAPTER 3 PUZZLE SCENE (drag-and-drop) ────────────────────────────────

// ── CHAPTER 3 PUZZLE SCENE — 4-step drag-and-drop ────────────────────────
class Ch3PuzzleScene extends Phaser.Scene {
  constructor(){super('Ch3PuzzleScene');}

  create(){
    this.cameras.main.fadeIn(450);
    const W=this.scale.width,H=this.scale.height;
    this._buildClinic(W,H);
    this.merlin=this.add.sprite(W-90,H-165,'merlin-sit').setDepth(10).setScale(1.1);
    this.dlg=new Dialogue(this);
    // Intro dialogue finishes BEFORE any draggables appear — no input conflict
    this.dlg.show([
      {speaker:'Merlin',text:'Merlin is doing science. This is what smart dogs do.'},
      {speaker:'Merlin',text:'Step one. The machine wants a token. Merlin has a token.'},
    ],()=>this._s1_setup());
  }

  _buildClinic(W,H){
    this.add.rectangle(W/2,H/2,W,H,0xEEF3FA);
    this.add.rectangle(W/2,H-65,W,130,0xDDE8F5);
    this.add.rectangle(W/2,H-127,W,4,0xCCDDEE);
    this.add.rectangle(W/2,20,W,40,0xE0EAF8);
    [-1,0,1].forEach(i=>this.add.rectangle(W/2+i*130,18,100,8,0xFFFFFF,0.9));
    const cross=this.add.graphics().setDepth(2);
    cross.fillStyle(0x3355AA,0.15);
    cross.fillRect(W/2-8,80,16,50);cross.fillRect(W/2-22,93,44,24);
    this.vend=this.add.sprite(95,H-215,'vending').setDepth(5).setScale(1.1);
    this.add.rectangle(W-80,H-175,110,12,0xCCDDEE).setDepth(4);
    this.add.rectangle(W-80,H-164,110,80,0xDDEEFF,0.8).setDepth(3);
    this.stepLabel=this.add.text(W/2,52,'Step 1 of 4: Put the token in the machine',{
      fontSize:'13px',color:'#334466',fontFamily:'Nunito,sans-serif',align:'center',
      backgroundColor:'#FFFFFF88',padding:{x:10,y:6}
    }).setOrigin(0.5).setDepth(20);
  }

  _toast(txt,dur=2000){
    const W=this.scale.width,H=this.scale.height;
    const t=this.add.text(W/2,H-175,txt,{
      fontSize:'13px',color:'#F0EAD8',fontFamily:'Nunito,sans-serif',
      backgroundColor:'#000000BB',padding:{x:10,y:6},align:'center',wordWrap:{width:290}
    }).setOrigin(0.5).setDepth(220).setAlpha(0);
    this.tweens.add({targets:t,alpha:1,duration:180,
      onComplete:()=>this.tweens.add({targets:t,alpha:0,duration:400,delay:dur,onComplete:()=>t.destroy()})});
  }

  _clearDrag(){ this.input.removeAllListeners('drag'); this.input.removeAllListeners('dragend'); }

  _makeDraggable(obj, dropFn){
    this.input.setDraggable(obj);
    this.input.on('drag',(p,o,dx,dy)=>{o.x=dx;o.y=dy;});
    this.input.on('dragend',(p,o)=>{
      if(o===obj){ if(!dropFn(o)) this.tweens.add({targets:o,x:o.homeX,y:o.homeY,duration:280,ease:'Back.Out'}); }
    });
  }

  _zone(x,y,w,h,label){
    const r=this.add.rectangle(x,y,w,h,0x334455,0.25).setDepth(6).setStrokeStyle(2,0x88AAFF,0.9);
    const t=this.add.text(x,y,label,{fontSize:'8px',color:'#88AAFF',fontFamily:'Nunito,sans-serif'}).setOrigin(0.5).setDepth(20);
    return {rect:r,text:t,destroy(){r.destroy();t.destroy();}};
  }

  // ── STEP 1: Token → coin slot ─────────────────────────────────────────
  _s1_setup(){
    const W=this.scale.width,H=this.scale.height;
    this.stepLabel.setText('Step 1 of 4: Put the token in the machine');
    this.token=this.add.sprite(W/2+55,H-212,'token').setDepth(15).setInteractive();
    this.token.homeX=W/2+55; this.token.homeY=H-212;
    this._slotZone=this._zone(95,H-262,42,18,'INSERT');
    this._clearDrag();
    this._makeDraggable(this.token,(obj)=>{
      if(Phaser.Math.Distance.Between(obj.x,obj.y,95,H-262)<42){ this._s1_done(); return true; }
      return false;
    });
  }

  _s1_done(){
    this._clearDrag(); this.token.disableInteractive(); this._slotZone.destroy();
    this.tweens.add({targets:this.token,x:95,y:this.scale.height-262,scale:0.4,alpha:0,duration:280,onComplete:()=>this.token.destroy()});
    try{Audio.beep(600,0.1,'sine',0.3);}catch(e){}
    this.cameras.main.flash(200,200,220,255);
    this._toast("The machine accepted Merlin's money. Merlin is basically a doctor.");
    this.time.delayedCall(550,()=>{
      const H=this.scale.height;
      this.packet=this.add.sprite(95,H-295,'packet').setDepth(15).setInteractive();
      this.packet.homeX=95; this.packet.homeY=H-252;
      this.tweens.add({targets:this.packet,y:H-252,duration:340,ease:'Bounce.Out'});
      this.stepLabel.setText("Step 2 of 4: Bring the packet to Merlin's paw");
      this.time.delayedCall(750,()=>this._s2_setup());
    });
  }

  // ── STEP 2: Packet → Merlin's paw ────────────────────────────────────
  _s2_setup(){
    const W=this.scale.width,H=this.scale.height;
    this._pawZone=this._zone(W-95,H-118,62,34,'PAW ZONE');
    this._clearDrag();
    this._makeDraggable(this.packet,(obj)=>{
      if(Phaser.Math.Distance.Between(obj.x,obj.y,W-95,H-118)<46){ this._s2_done(); return true; }
      return false;
    });
  }

  _s2_done(){
    this._clearDrag(); this._pawZone.destroy();
    const W=this.scale.width,H=this.scale.height;
    this.tweens.add({targets:this.packet,x:W-95,y:H-118,duration:240});
    this.packet.homeX=W-95; this.packet.homeY=H-118;
    try{Audio.beep(480,0.08,'sine',0.22);}catch(e){}
    this._toast("This packet is for Merlin's paw. Merlin has many credentials.");
    this.stepLabel.setText('Step 3 of 4: Open the packet');
    this.time.delayedCall(900,()=>this._s3_setup());
  }

  // ── STEP 3: Packet → tear zone ────────────────────────────────────────
  _s3_setup(){
    const W=this.scale.width,H=this.scale.height;
    this._tearZone=this._zone(W/2+10,H-218,82,36,'TEAR OPEN');
    this._clearDrag();
    this._makeDraggable(this.packet,(obj)=>{
      if(Phaser.Math.Distance.Between(obj.x,obj.y,W/2+10,H-218)<52){ this._s3_done(); return true; }
      return false;
    });
  }

  _s3_done(){
    this._clearDrag(); this.packet.disableInteractive(); this._tearZone.destroy();
    const W=this.scale.width,H=this.scale.height;
    this.tweens.add({targets:this.packet,scaleX:1.5,scaleY:0.5,x:W/2+10,y:H-218,duration:110,yoyo:true,
      onComplete:()=>{
        this.packet.setAlpha(0.3);
        // Powder burst
        for(let i=0;i<8;i++){
          const p=this.add.circle(W/2+10+Phaser.Math.Between(-28,28),H-218+Phaser.Math.Between(-14,14),Phaser.Math.Between(3,10),0xFFFFFF,0.9).setDepth(16);
          this.tweens.add({targets:p,y:p.y-Phaser.Math.Between(28,58),alpha:0,duration:680,delay:i*52,onComplete:()=>p.destroy()});
        }
        try{Audio.beep(800,0.06,'square',0.18);}catch(e){}
        this._toast('The science is open. It smells like mistakes and clouds.');
        // Substance sprite
        this.substance=this.add.circle(W/2+10,H-218,15,0xAAEEFF,0.95).setDepth(15).setInteractive();
        this.substance.homeX=W/2+10; this.substance.homeY=H-218;
        this.tweens.add({targets:this.substance,scale:1.2,duration:580,yoyo:true,repeat:-1});
        this.stepLabel.setText('Step 4 of 4: Give Merlin the science');
        this.time.delayedCall(800,()=>this._s4_setup());
      }});
  }

  // ── STEP 4: Substance → Merlin's face ────────────────────────────────
  _s4_setup(){
    const W=this.scale.width,H=this.scale.height;
    this._faceZone=this._zone(W-90,H-212,58,40,'FACE');
    this._clearDrag();
    this._makeDraggable(this.substance,(obj)=>{
      if(Phaser.Math.Distance.Between(obj.x,obj.y,W-90,H-212)<52){ this._s4_done(); return true; }
      return false;
    });
  }

  _s4_done(){
    this._clearDrag(); this._faceZone.destroy();
    this.substance.disableInteractive();
    this.tweens.add({targets:this.substance,scale:0,alpha:0,duration:280});
    try{Audio.beep(440,0.3,'sine',0.22);}catch(e){}
    this.cameras.main.flash(300,255,255,200);
    this.dlg.show([
      {speaker:'Merlin',text:'Oh.'},
      {speaker:'Merlin',text:'OH.'},
      {speaker:'Merlin',text:'The floor is very interesting. Also the ceiling. They are the same.'},
    ],()=>{
      this.cameras.main.fadeOut(600);
      this.time.delayedCall(600,()=>this.scene.start('Ch3TripScene'));
    });
  }
}

class Ch3TripScene extends Phaser.Scene {
  constructor(){super('Ch3TripScene');}

  create(){
    this.cameras.main.fadeIn(800);
    const W=this.scale.width,H=this.scale.height;
    this.W=W; this.H=H;
    this._buildRoom(W,H);
    // Couch positioned center-lower screen
    this.couchY=H-200;
    this.couch=this.add.sprite(W/2,this.couchY,'couch').setDepth(8).setScale(1.3);
    this.merlin=this.add.sprite(W/2,this.couchY-68,'merlin-sit').setDepth(9).setScale(1.0);
    this.dlg=new Dialogue(this);
    // Pre-trip dialogue
    this.time.delayedCall(600,()=>{
      this.dlg.show([
        {speaker:'Merlin',text:'Merlin is on the couch now. This is familiar. Merlin likes couches.'},
        {speaker:'Merlin',text:'Wait. The couch is very soft. More soft than normal soft.'},
        {speaker:'Merlin',text:'The couch is... moving? The couch is ALIVE.'},
        {speaker:'Merlin',text:'Merlin and the couch are friends now. Best friends.'},
        {speaker:'Merlin',text:'Is dad here? Dad smells like safe. Merlin misses dad.'},
      ],()=>this._startGame());
    });
  }

  _buildRoom(W,H){
    // Starts normal, will get weird during game
    this.bgRect=this.add.rectangle(W/2,H/2,W,H,0x1a1008);
    // Floor
    this.add.rectangle(W/2,H-50,W,100,0x120a04).setDepth(1);
    // Wall
    this.wallRect=this.add.rectangle(W/2,H/2-60,W,H*0.6,0x1e1408).setDepth(0);
    // Floating elements (will animate during trip)
    this.floaters=[];
    const floatItems=['🦴','⭐','🐾','🦴','⭐','🐾'];
    floatItems.forEach((emoji,i)=>{
      const f=this.add.text(
        Phaser.Math.Between(30,W-30),
        Phaser.Math.Between(50,H/2),
        emoji,{fontSize:'24px'}
      ).setDepth(5).setAlpha(0);
      this.floaters.push(f);
    });
    // Dad face in clouds (text placeholder)
    this.dadFace=this.add.text(W/2,H/4,'"DAD?"',{fontSize:'28px',color:'#FFD700',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5).setDepth(6).setAlpha(0);
  }

  _startGame(){
    const W=this.W,H=this.H;
    // Hide dialogue during game
    this._playBgColors=true;
    this._bgHue=0;

    // Balance game state
    this.merlinOffset=0;   // how far Merlin is from center (-1 to 1)
    this.tiltAngle=0;      // couch tilt in radians
    this.gameRunning=true;
    this.surviveTimer=20;  // seconds to survive
    this.survived=false;
    this._keys={left:false,right:false};

    // Show timer
    this.timerText=this.add.text(W/2,28,'Stay on the couch: 20s',{
      fontSize:'16px',color:'#D4A843',fontFamily:'Fredoka One,sans-serif'
    }).setOrigin(0.5).setDepth(20);

    // Show instructions briefly
    const inst=this.add.text(W/2,H/2-20,'Keep Merlin on the couch!',{
      fontSize:'18px',color:'#F0EAD8',fontFamily:'Fredoka One,sans-serif',
      backgroundColor:'#000000AA',padding:{x:12,y:8}
    }).setOrigin(0.5).setDepth(21);
    this.tweens.add({targets:inst,alpha:0,duration:400,delay:2000,onComplete:()=>inst.destroy()});

    // Animate floaters
    this.floaters.forEach((f,i)=>{
      this.tweens.add({targets:f,alpha:0.7,y:f.y-30,duration:1500+i*300,
        yoyo:true,repeat:-1,ease:'Sine.easeInOut',delay:i*200});
    });
    // Dad face pulses in and out
    this.tweens.add({targets:this.dadFace,alpha:0.6,duration:3000,yoyo:true,repeat:-1,delay:4000});

    // Controls
    this._buildBalanceControls();

    // Update loop via time event
    this._lastUpdate=this.time.now;
    this._gameEvent=this.time.addEvent({delay:16,repeat:-1,callback:this._updateGame,callbackScope:this});
  }

  _buildBalanceControls(){
    const W=this.W,H=this.H;
    const btnStyle='position:absolute;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;border-radius:50%;touch-action:none;background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.25);width:80px;height:80px;';
    // These are DOM buttons since they need to coexist with Phaser
    const gameCanvas=this.game.canvas;
    const rect=gameCanvas.getBoundingClientRect();
    const scaleX=rect.width/this.game.config.width;
    const scaleY=rect.height/this.game.config.height;

    this._domBtns=[];
    const makeBtn=(label,x,y,key)=>{
      const b=document.createElement('div');
      b.dataset.ch3btn='1';
      b.style.cssText=`${btnStyle}position:fixed;left:${rect.left+x*scaleX}px;top:${rect.top+y*scaleY}px;`;
      b.textContent=label;
      b.addEventListener('touchstart',e=>{e.preventDefault();this._keys[key]=true;},{passive:false});
      b.addEventListener('touchend',  e=>{e.preventDefault();this._keys[key]=false;},{passive:false});
      b.addEventListener('mousedown', ()=>this._keys[key]=true);
      b.addEventListener('mouseup',   ()=>this._keys[key]=false);
      document.body.appendChild(b);
      this._domBtns.push(b);
    };
    makeBtn('◀',20,H-110,'left');
    makeBtn('▶',W-100,H-110,'right');
    this.events.once('shutdown',()=>this._cleanupBtns());
    this.events.once('destroy', ()=>this._cleanupBtns());
  }

  _cleanupBtns(){
    if(this._domBtns){
      this._domBtns.forEach(b=>{if(b.parentNode)b.parentNode.removeChild(b);});
      this._domBtns=[];
    }
  }

  _updateGame(){
    if(!this.gameRunning)return;
    const now=this.time.now;
    const dt=Math.min((now-this._lastUpdate)/1000,0.05);
    this._lastUpdate=now;

    // Automatic couch sway (increases over time)
    const elapsed=20-this.surviveTimer;
    const swaySpeed=0.8+elapsed*0.06;
    const swayAmp=0.18+elapsed*0.008;
    this.tiltAngle=Math.sin(now/1000*swaySpeed)*swayAmp;

    // Player input counters the sway
    if(this._keys.left) this.merlinOffset=Math.max(-1,this.merlinOffset-dt*1.2);
    if(this._keys.right)this.merlinOffset=Math.min(1, this.merlinOffset+dt*1.2);

    // Physics: Merlin slides toward downhill side
    this.merlinOffset+=this.tiltAngle*dt*2.2;
    this.merlinOffset=Phaser.Math.Clamp(this.merlinOffset,-1.2,1.2);

    // Apply couch tilt visually
    this.couch.setRotation(this.tiltAngle);
    // Merlin position follows couch surface
    const couchHalfW=130;
    this.merlin.setRotation(this.tiltAngle);
    this.merlin.x=this.W/2+this.merlinOffset*couchHalfW*Math.cos(this.tiltAngle);
    this.merlin.y=this.couchY-68+this.merlinOffset*couchHalfW*Math.sin(this.tiltAngle);

    // Psychedelic background color cycling
    if(this._playBgColors){
      this._bgHue=(this._bgHue+dt*40)%360;
      const h=this._bgHue;
      // Simple hue-to-RGB approximation
      const r=Math.floor(Math.sin(h*Math.PI/180)*80+80);
      const g=Math.floor(Math.sin((h+120)*Math.PI/180)*60+60);
      const b2=Math.floor(Math.sin((h+240)*Math.PI/180)*80+40);
      this.bgRect.setFillStyle(Phaser.Display.Color.GetColor(r,g,b2));
    }

    // Countdown timer
    this.surviveTimer-=dt;
    if(this.surviveTimer>0){
      this.timerText.setText(`Stay on the couch: ${Math.ceil(this.surviveTimer)}s`);
    }

    // Fall off?
    if(Math.abs(this.merlinOffset)>=1.1){
      this.gameRunning=false;
      this._fall();
      return;
    }

    // Win?
    if(this.surviveTimer<=0){
      this.gameRunning=false;
      this._win();
    }
  }

  _fall(){
    if(this._gameEvent){this._gameEvent.remove();this._gameEvent=null;}
    this._cleanupBtns();
    Audio.slideDown();
    this.cameras.main.shake(300,0.015);
    this.tweens.add({targets:this.merlin,y:this.merlin.y+120,rotation:Math.PI/2,alpha:0,duration:500,
      onComplete:()=>{
        // Reset Merlin on couch, try again
        this.merlin.setPosition(this.W/2,this.couchY-68).setRotation(0).setAlpha(1);
        this.couch.setRotation(0);
        this.merlinOffset=0; this.tiltAngle=0;
        this.survived=false;
        const msg=this.add.text(this.W/2,this.H/2,'Merlin rolled off!\nTrying again...',{
          fontSize:'18px',color:'#F0EAD8',fontFamily:'Fredoka One,sans-serif',align:'center',
          backgroundColor:'#000000BB',padding:{x:14,y:10}
        }).setOrigin(0.5).setDepth(25);
        this.time.delayedCall(1800,()=>{
          this.tweens.add({targets:msg,alpha:0,duration:300,onComplete:()=>{
            msg.destroy();
            // Restart balance
            this.surviveTimer=20;
            this.gameRunning=true;
            this._lastUpdate=this.time.now;
            this._buildBalanceControls();
            this._gameEvent=this.time.addEvent({delay:16,repeat:-1,callback:this._updateGame,callbackScope:this});
          }});
        });
      }
    });
  }

  _win(){
    if(this._gameEvent){this._gameEvent.remove();this._gameEvent=null;}
    this._cleanupBtns();
    this._playBgColors=false;
    this.bgRect.setFillStyle(0x1a1008);
    this.couch.setRotation(0);
    this.merlin.setPosition(this.W/2,this.couchY-68).setRotation(0);
    this.timerText.destroy();
    Audio.fanfare();
    // Post-trip dialogue
    this.time.delayedCall(500,()=>{
      this.dlg.show([
        {speaker:'Merlin',text:'Merlin is okay. The couch was a good friend.'},
        {speaker:'Merlin',text:'The K is done now. Merlin remembers everything and also nothing.'},
        {speaker:'Merlin',text:'He thinks he saw dad\'s face in the sky. That is probably normal.'},
        {speaker:'Merlin',text:'Adventure is very much.'},
      ],()=>{
        titleCard(this,'CHAPTER 4','"MERLIN REALIZES HE IS LOST"',()=>{
          this._cleanupBtns();
          this.cameras.main.fadeOut(400);
          this.time.delayedCall(400,()=>this.scene.start('Ch4GasScene'));
        });
      });
    });
  }
}

// [INIT_REPLACED_CH4]

// ── CHAPTER 4: GAS STATION SCENE ─────────────────────────────────────────
class Ch4GasScene extends Phaser.Scene {
  constructor(){super('Ch4GasScene');}

  create(){
    this.cameras.main.fadeIn(500);
    const W=this.scale.width,H=this.scale.height;
    this._buildScene(W,H);
    this.merlin=this.add.sprite(W*0.2,H-160,'merlin-w1').setFlipX(true).setDepth(10);
    this.dlg=new Dialogue(this);
    this.time.delayedCall(500,()=>this._start());
  }

  _buildScene(W,H){
    this.add.rectangle(W/2,H/2,W,H,0x06060f);
    for(let i=0;i<38;i++) this.add.circle(Phaser.Math.Between(0,W),Phaser.Math.Between(0,H*0.38),Phaser.Math.Between(1,2),0xFFFFFF,Phaser.Math.FloatBetween(0.2,0.95));
    // Gas station building
    this.add.rectangle(W*0.65,H/2-55,220,240,0x252535);
    this.add.rectangle(W*0.65,H/2-55,216,236,0x333344,0.9);
    // Canopy over pumps
    this.add.rectangle(W*0.28,H-195,140,12,0x3a4a5a);
    this.add.rectangle(W*0.28,H-215,8,50,0x3a4a5a); this.add.rectangle(W*0.28+60,H-215,8,50,0x3a4a5a);
    // Gas pumps
    [W*0.2,W*0.36].forEach(x=>{
      this.add.rectangle(x,H-185,22,55,0x4a5a6a).setDepth(3);
      this.add.rectangle(x,H-205,24,8,0x5a6a7a).setDepth(3);
      this.add.rectangle(x,H-200,12,18,0x88AACC,0.7).setDepth(4);
    });
    // Station sign
    const sign=this.add.text(W*0.65,H/2-165,'BUCKY\'S 24HR\nGAS & MAPS',{fontSize:'13px',color:'#FFCC44',fontFamily:'Fredoka One,sans-serif',align:'center'}).setOrigin(0.5).setDepth(3);
    this.tweens.add({targets:sign,alpha:0.55,duration:800,yoyo:true,repeat:-1});
    // Windows
    [[W*0.55,H/2-80],[W*0.75,H/2-80],[W*0.55,H/2-20],[W*0.75,H/2-20]].forEach(([x,y])=>{
      this.add.rectangle(x,y,44,32,0x88AACC,0.6).setDepth(3);
      this.add.rectangle(x,y,40,28,0x99BBDD,0.4).setDepth(3);
    });
    // Door
    this.add.rectangle(W*0.65,H-168,36,68,0x667788).setDepth(3);
    // Map rack inside (visible through door area)
    this.add.rectangle(W*0.65-40,H-200,20,44,0x4a3a2a).setDepth(4);
    this.add.text(W*0.65-40,H-222,'MAPS',{fontSize:'9px',color:'#DDBB66',fontFamily:'Nunito,sans-serif'}).setOrigin(0.5).setDepth(5);
    // Ground
    this.add.rectangle(W/2,H-65,W,130,0x10100e);
    // Streetlight
    this.add.rectangle(W*0.08,H-310,4,280,0x333340);
    this.add.circle(W*0.08,H-312,9,0xFFFFBB);
    this.add.circle(W*0.08,H-312,50,0xFFFFBB,0.05);
  }

  _start(){
    this.dlg.show([
      {speaker:'Merlin',text:'Merlin knows every smell of home. This is not those smells.'},
      {speaker:'Merlin',text:'Merlin is... where is Merlin.'},
      {speaker:'Merlin',text:'There is a gas station. Gas stations have snacks. Also possibly maps. Both are important.'},
    ],()=>this._enterStation());
  }

  _enterStation(){
    const W=this.scale.width,H=this.scale.height; let f=0;
    this.tweens.add({targets:this.merlin,x:W*0.65,duration:1400,ease:'Linear',
      onUpdate:()=>{f++;this.merlin.setTexture(f%14<7?'merlin-w1':'merlin-w2');},
      onComplete:()=>{ this.merlin.setTexture('merlin-sit'); this._mapGag(); }});
  }

  _mapGag(){
    const W=this.scale.width,H=this.scale.height;
    // Map paper unfolds
    const paper=this.add.rectangle(W/2,H/2-30,280,190,0xF5ECD0).setDepth(12).setAlpha(0);
    const g=this.add.graphics().setDepth(13).setAlpha(0);
    g.lineStyle(1,0xAA8844,0.4);
    for(let x=0;x<280;x+=28) g.lineBetween(W/2-140+x,H/2-125,W/2-140+x,H/2+65);
    for(let y=0;y<190;y+=20) g.lineBetween(W/2-140,H/2-125+y,W/2+140,H/2-125+y);
    const here=this.add.text(W/2+70,H/2-40,'📍 HERE\n(bad area)',{fontSize:'10px',color:'#CC3333',fontFamily:'Nunito,sans-serif',align:'center'}).setDepth(14).setAlpha(0);
    const home=this.add.text(W/2-70,H/2+40,'🏠 HOME\n(dad smell)',{fontSize:'10px',color:'#228833',fontFamily:'Nunito,sans-serif',align:'center'}).setDepth(14).setAlpha(0);
    const arrow=this.add.text(W/2+5,H/2-5,'↙',{fontSize:'32px',color:'#D4A843'}).setDepth(14).setAlpha(0);
    this.tweens.add({targets:[paper,g,here,home,arrow],alpha:1,duration:450});

    Audio.modem();
    this.dlg.show([
      {speaker:'Merlin',text:'Merlin is reading the map. This is advanced. Very few dogs read maps. Merlin is one of the few.'},
    ],()=>{
      this.time.delayedCall(300,()=>{ Audio.modem(); });
      this.time.delayedCall(1400,()=>{
        this.tweens.add({targets:[paper,g,here,home,arrow],alpha:0,duration:380});
        this.dlg.show([
          {speaker:'Merlin',text:'Okay. Home is South. Or it smells South. Merlin is going South.'},
          {speaker:'Merlin',text:'Wait. Merlin smells something. He should investigate the smells before committing.'},
        ],()=>this._smellChoice());
      });
    });
  }

  _smellChoice(){
    const W=this.scale.width,H=this.scale.height;
    this.add.text(W/2,H-310,'Which smell should Merlin follow?',{fontSize:'13px',color:'#A09070',fontFamily:'Nunito,sans-serif'}).setOrigin(0.5).setDepth(20);
    const opts=[
      {emoji:'🌭',line1:'Hot dog smell',line2:'(very compelling)',wrong:true,txt:'Merlin followed the hot dog smell for forty feet. It led to a trash can. The trash can was not dad. Merlin is disappointed but also interested in the trash can.'},
      {emoji:'🦝',line1:'Something chaotic',line2:'(small angry wizard?)',wrong:true,txt:'Merlin thinks this raccoon smell belongs to a small angry wizard. This is not home. Merlin respects the wizard but cannot follow.'},
      {emoji:'🏠',line1:'Safe smell south',line2:'(dad? maybe dad?)',wrong:false,txt:'Yes. That is it. That is the smell of South. And also possibly Dad. GO. MERLIN GO.'},
    ];
    this._smellBtns=[];
    opts.forEach((o,i)=>{
      const bx=65+i*130, by=H-235;
      const bg=this.add.rectangle(bx,by,118,72,0x1a1008,0.92).setDepth(210).setInteractive().setStrokeStyle(1,0xD4A843,0.5);
      const em=this.add.text(bx,by-22,o.emoji,{fontSize:'24px'}).setOrigin(0.5).setDepth(211);
      const t1=this.add.text(bx,by+6,o.line1,{fontSize:'12px',color:'#F0EAD8',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5).setDepth(211);
      const t2=this.add.text(bx,by+22,o.line2,{fontSize:'10px',color:'#A09070',fontFamily:'Nunito,sans-serif'}).setOrigin(0.5).setDepth(211);
      bg.on('pointerover',()=>bg.setFillStyle(0x2a2010,0.95));
      bg.on('pointerout', ()=>bg.setFillStyle(0x1a1008,0.92));
      bg.on('pointerdown',()=>{
        this._smellBtns.forEach(([b,e,a,c])=>{b.destroy();e.destroy();a.destroy();c.destroy();});
        if(o.wrong){
          this.dlg.show([{speaker:'Merlin',text:o.txt}],()=>{
            this.dlg.show([{speaker:'Merlin',text:'Back to smelling. There are more options.'}],()=>this._smellChoice());
          });
        } else {
          this.dlg.show([{speaker:'Merlin',text:o.txt}],()=>{
            this.cameras.main.fadeOut(500);
            this.time.delayedCall(500,()=>this.scene.start('Ch4NavScene'));
          });
        }
      });
      this._smellBtns.push([bg,em,t1,t2]);
    });
  }
}

// ── CHAPTER 4: TOP-DOWN NAVIGATION GAME ──────────────────────────────────
class Ch4NavScene extends Phaser.Scene {
  constructor(){super('Ch4NavScene');}

  create(){
    this.cameras.main.fadeIn(400);
    this.W=390; this.H=700; this.mapH=1850;

    this.mState='active'; // active | stunned | squirrel | cat | raccoon | raccoonWait | won
    this.mSpeed=94;
    this.keys={up:false,down:false,left:false,right:false,stop:false};
    this._hadCarHit=false;
    this._carPool=[];
    this._domBtns=[];

    this._buildWorld();
    this._spawnMerlin();
    this._placeObstacles();
    this._buildHUD();
    this._buildControls();
    this._bindKeyboard();

    this.cameras.main.setBounds(0,0,this.W,this.mapH);
    this.cameras.main.startFollow(this.merlin,true,0.08,0.1);

    this.dlg=new Dialogue(this);

    this._carEvent=this.time.addEvent({delay:2600,repeat:-1,callback:this._spawnCar,callbackScope:this});
    this._lastT=this.time.now;
    this._loop=this.time.addEvent({delay:16,repeat:-1,callback:this._update,callbackScope:this});

    this.time.delayedCall(800,()=>{
      this.dlg.show([
        {speaker:'Merlin',text:'Home is South. Merlin is going South. Cross the roads carefully. The big fast things are real.'},
      ],()=>{});
    });
  }

  // ── WORLD BUILD ───────────────────────────────────────────────────────
  _buildWorld(){
    const W=this.W, H=this.mapH;
    const g=this.add.graphics();

    g.fillStyle(0x141418);g.fillRect(0,0,W,H);
    g.fillStyle(0x1a1a2a);g.fillRect(0,0,35,H);     // left bldg
    g.fillStyle(0x1a1a2a);g.fillRect(355,0,35,H);   // right bldg
    g.fillStyle(0x6a6a58);g.fillRect(35,0,110,H);   // left sidewalk
    g.fillStyle(0x6a6a58);g.fillRect(245,0,110,H);  // right sidewalk
    g.fillStyle(0x252520);g.fillRect(145,0,100,H);  // road

    // Lane markings
    g.fillStyle(0x888800,0.65);
    for(let y=0;y<H;y+=52) g.fillRect(190,y,10,30);

    // Crossings
    this._crossings=[295,615,940,1265];
    this._crossings.forEach(cy=>{
      g.fillStyle(0x3a3a34);g.fillRect(35,cy,310,78);
      g.fillStyle(0x555550,0.45);
      for(let x=155;x<245;x+=17) g.fillRect(x,cy,9,78);
      g.fillStyle(0xFFFFAA,0.35);
      g.fillRect(35,cy,110,3);g.fillRect(245,cy,110,3);
      g.fillRect(35,cy+75,110,3);g.fillRect(245,cy+75,110,3);
    });

    // Night band near raccoon
    g.fillStyle(0x000010,0.5);g.fillRect(35,1070,310,200);

    // Home zone glow
    g.fillStyle(0xCC9922,0.18);g.fillRect(35,1700,310,148);
    g.fillStyle(0xFFCC44,0.1);g.fillRect(35,1760,310,88);

    // Window lights on buildings (random)
    for(let wy=60;wy<H-60;wy+=76){
      const on1=Math.random()>0.45, on2=Math.random()>0.45;
      if(on1){g.fillStyle(0xFFEE88,0.7);g.fillRect(4,wy,13,18);g.fillRect(18,wy,13,18);}
      if(on2){g.fillStyle(0xFFEE88,0.7);g.fillRect(358,wy,13,18);g.fillRect(372,wy,13,18);}
    }

    // Home street sign
    this.add.text(195,1720,'HOME STREET',{fontSize:'17px',color:'#FFCC44',fontFamily:'Fredoka One,sans-serif',align:'center'}).setOrigin(0.5).setDepth(5);
    this.add.text(195,1748,'(familiar smell detected)',{fontSize:'11px',color:'#DDAA00',fontFamily:'Nunito,sans-serif',align:'center'}).setOrigin(0.5).setDepth(5);
  }

  // ── MERLIN ────────────────────────────────────────────────────────────
  _spawnMerlin(){
    this.merlin=this.add.sprite(90,55,'merlin-sit').setScale(0.48).setDepth(10);
  }

  // ── OBSTACLES ─────────────────────────────────────────────────────────
  _placeObstacles(){
    const add=(x,y,emoji)=>{
      return { x, y, sprite:this.add.text(x,y,emoji,{fontSize:'22px'}).setOrigin(0.5).setDepth(9),
               triggered:false, done:false };
    };
    this.obs={
      squirrel: add(90,490,'🐿'),
      cat:      add(90,795,'🐱'),
      rivaldog: add(300,1055,'🐕'),
      raccoon:  add(90,1165,'🦝'),
    };
  }

  // ── HUD (scrollFactor=0 = fixed to screen) ────────────────────────────
  _buildHUD(){
    const W=this.W,H=this.H;
    this.capBg=this.add.rectangle(W/2,32,W-10,52,0x000000,0.82).setDepth(50).setScrollFactor(0).setVisible(false);
    this.capTxt=this.add.text(10,8,'',{fontSize:'12px',color:'#F0EAD8',fontFamily:'Nunito,sans-serif',wordWrap:{width:W-20}}).setDepth(51).setScrollFactor(0);
    // Progress bar
    this.add.rectangle(W-10,H/2,6,H*0.55,0x222222,0.8).setDepth(50).setScrollFactor(0);
    this.progDot=this.add.circle(W-10,H/2,5,0xD4A843).setDepth(51).setScrollFactor(0);
  }

  _cap(txt,dur=3800){
    this.capBg.setVisible(true).setScrollFactor(0);
    this.capTxt.setText(txt).setScrollFactor(0);
    if(this._capT)clearTimeout(this._capT);
    this._capT=setTimeout(()=>{this.capBg.setVisible(false);this.capTxt.setText('');},dur);
  }

  // ── CONTROLS ──────────────────────────────────────────────────────────
  _buildControls(){
    const W=this.W,H=this.H;
    const base=`position:fixed;display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:20px;border-radius:8px;touch-action:none;width:46px;height:46px;
      background:rgba(255,255,255,0.13);border:2px solid rgba(255,255,255,0.26);`;
    const BY=H-152,LX=18;
    const btn=(t,l,lbl,k)=>{
      const b=document.createElement('div');
      b.dataset.navbtn='1';
      b.style.cssText=`${base}position:fixed;top:${BY+t}px;left:${LX+l}px;`;
      b.textContent=lbl;
      b.addEventListener('touchstart',e=>{e.preventDefault();this.keys[k]=true;},{passive:false});
      b.addEventListener('touchend',  e=>{e.preventDefault();this.keys[k]=false;},{passive:false});
      b.addEventListener('mousedown', ()=>this.keys[k]=true);
      b.addEventListener('mouseup',   ()=>this.keys[k]=false);
      document.body.appendChild(b);
      this._domBtns.push(b);
    };
    btn(0, 46,'▲','up'); btn(94,46,'▼','down'); btn(47,0,'◀','left'); btn(47,92,'▶','right');
    this.events.once('shutdown',()=>this._cleanDOM());
    this.events.once('destroy', ()=>this._cleanDOM());
  }

  _cleanDOM(){
    this._domBtns.forEach(b=>{if(b.parentNode)b.parentNode.removeChild(b);});
    this._domBtns=[];
    if(this._kd)window.removeEventListener('keydown',this._kd);
    if(this._ku)window.removeEventListener('keyup',  this._ku);
  }

  _bindKeyboard(){
    window.addEventListener('keydown',this._kd=e=>{
      if(e.key==='ArrowUp'   ||e.key==='w')this.keys.up=true;
      if(e.key==='ArrowDown' ||e.key==='s')this.keys.down=true;
      if(e.key==='ArrowLeft' ||e.key==='a')this.keys.left=true;
      if(e.key==='ArrowRight'||e.key==='d')this.keys.right=true;
      if(e.key===' ')this.keys.stop=true;
    });
    window.addEventListener('keyup',this._ku=e=>{
      if(e.key==='ArrowUp'   ||e.key==='w')this.keys.up=false;
      if(e.key==='ArrowDown' ||e.key==='s')this.keys.down=false;
      if(e.key==='ArrowLeft' ||e.key==='a')this.keys.left=false;
      if(e.key==='ArrowRight'||e.key==='d')this.keys.right=false;
      if(e.key===' ')this.keys.stop=false;
    });
  }

  // ── CAR SPAWNING ──────────────────────────────────────────────────────
  _spawnCar(){
    if(this.mState==='won') return;
    // Only spawn in crossing zones within camera view
    const camY=this.cameras.main.scrollY;
    const activeCrossing=this._crossings.find(cy=>cy>camY-100&&cy<camY+800);
    if(!activeCrossing) return;
    const fromLeft=Math.random()>0.5;
    const carY=activeCrossing+Phaser.Math.Between(10,58);
    const colors=[0xCC2200,0x0044AA,0x228800,0x996600,0x553399];
    const car=this.add.rectangle(fromLeft?135:260,carY,55,20,colors[Math.floor(Math.random()*colors.length)]).setDepth(8);
    const vx=fromLeft?230:-230;
    this._carPool.push({sprite:car,vx,endX:fromLeft?265:130});
  }

  // ── MAIN LOOP ─────────────────────────────────────────────────────────
  _update(){
    if(this.mState==='won') return;
    const now=this.time.now;
    const dt=Math.min((now-this._lastT)/1000,0.05);
    this._lastT=now;

    // Move cars
    this._carPool.forEach((c,i)=>{
      c.sprite.x+=c.vx*dt;
      if((c.vx>0&&c.sprite.x>c.endX+90)||(c.vx<0&&c.sprite.x<c.endX-90)){
        c.sprite.destroy(); this._carPool.splice(i,1);
      }
    });

    // Merlin movement (blocked during raccoon event and stunned)
    if(this.mState==='active'||this.mState==='squirrel'||this.mState==='cat'){
      const spd=this.mState==='cat'?36:this.mSpeed;
      let vx=0,vy=0;
      if(this.keys.up)   vy=-spd;
      if(this.keys.down) vy= spd;
      if(this.keys.left) vx=-spd;
      if(this.keys.right)vx= spd;

      // Squirrel drift (unless player holds stop)
      if(this.mState==='squirrel'&&!this.keys.stop){
        vx+=(90-this.merlin.x)*0.5;
        vy-=18;
      }

      const nx=Phaser.Math.Clamp(this.merlin.x+vx*dt,36,354);
      const ny=Phaser.Math.Clamp(this.merlin.y+vy*dt,20,this.mapH-30);
      this.merlin.x=nx; this.merlin.y=ny;

      // Car collision check (when in road zone x=145-245)
      if(this.merlin.x>145&&this.merlin.x<245&&this.mState!=='stunned'){
        this._carPool.forEach(c=>{
          if(Phaser.Math.Distance.Between(this.merlin.x,this.merlin.y,c.sprite.x,c.sprite.y)<34){
            this._carHit();
          }
        });
      }
    }

    // Obstacle checks
    this._checkObs();

    // Win check
    if(this.merlin.y>=1700&&this.mState!=='won') this._win();

    // Progress dot
    const p=Phaser.Math.Clamp((this.merlin.y-50)/(1700-50),0,1);
    this.progDot.y=this.H/2-(p-0.5)*this.H*0.5;
  }

  // ── OBSTACLE CHECKS ───────────────────────────────────────────────────
  _checkObs(){
    const my=this.merlin.y;

    if(!this.obs.squirrel.done&&!this.obs.squirrel.triggered&&Math.abs(my-490)<90&&this.mState==='active')
      this._squirrelEvent();

    if(!this.obs.cat.done&&!this.obs.cat.triggered&&Math.abs(my-795)<75&&this.mState==='active')
      this._catEvent();

    if(!this.obs.rivaldog.done&&my>1045&&my<1068){
      this.obs.rivaldog.done=true;
      this._cap('That dog is being very rude. Merlin is choosing to be the bigger dog. (Merlin is also a big dog.)');
    }

    if(!this.obs.raccoon.done&&!this.obs.raccoon.triggered&&my>1150&&this.mState==='active')
      this._raccoonEvent();
  }

  // ── CAR HIT ───────────────────────────────────────────────────────────
  _carHit(){
    this.mState='stunned';
    this.cameras.main.shake(280,0.012);
    try{Audio.boof(0.7);}catch(e){}
    const first=!this._hadCarHit; this._hadCarHit=true;
    const tx=this.merlin.x<195?88:302;
    this.tweens.add({targets:this.merlin,x:tx,duration:230,
      onComplete:()=>{
        this._cap(first?'THAT WAS A BIG FAST THING AND MERLIN DID NOT LIKE IT':'Merlin did not enjoy that either. Still.',first?4200:2500);
        this.time.delayedCall(1100,()=>{this.mState='active';});
      }});
  }

  // ── SQUIRREL ──────────────────────────────────────────────────────────
  _squirrelEvent(){
    this.obs.squirrel.triggered=true; this.mState='squirrel';
    this._cap('NO. Merlin is on a mission. The squirrel can wait. THE SQUIRREL CANNOT WAIT—no. Focus.',5200);
    // Show FOCUS button
    const fb=document.createElement('div');
    fb.dataset.navbtn='1'; fb.id='nav-focus-btn';
    fb.textContent='FOCUS'; fb.style.cssText='position:fixed;bottom:185px;right:18px;padding:10px 16px;background:rgba(200,30,30,0.88);border:2px solid rgba(255,80,80,0.9);border-radius:8px;color:#fff;font-family:"Fredoka One",sans-serif;font-size:16px;cursor:pointer;touch-action:none;z-index:1001;';
    fb.addEventListener('touchstart',e=>{e.preventDefault();this.keys.stop=true;},{passive:false});
    fb.addEventListener('touchend',  e=>{e.preventDefault();this.keys.stop=false;},{passive:false});
    fb.addEventListener('mousedown',()=>this.keys.stop=true);
    fb.addEventListener('mouseup',  ()=>this.keys.stop=false);
    document.body.appendChild(fb); this._domBtns.push(fb);
    this.time.addEvent({delay:5200,callback:()=>{
      this.obs.squirrel.done=true; this.obs.squirrel.sprite.destroy();
      const focusBtn=document.getElementById('nav-focus-btn');
      if(focusBtn)focusBtn.parentNode.removeChild(focusBtn);
      if(this.mState==='squirrel')this.mState='active';
    }});
  }

  // ── CAT ───────────────────────────────────────────────────────────────
  _catEvent(){
    this.obs.cat.triggered=true; this.mState='cat';
    this._cap('Cat is doing the stare. Merlin does not understand the stare. It makes Merlin feel weird.',4000);
    this.time.addEvent({delay:3200,callback:()=>{
      this.obs.cat.done=true; this.obs.cat.sprite.destroy();
      if(this.mState==='cat')this.mState='active';
    }});
  }

  // ── RACCOON ───────────────────────────────────────────────────────────
  _raccoonEvent(){
    this.obs.raccoon.triggered=true; this.mState='raccoon';
    this._cap('A raccoon. It is blocking the path. Merlin thinks it might be a small angry wizard.',5000);
    this.time.delayedCall(1600,()=>this._showRaccoonChoice());
  }

  _showRaccoonChoice(){
    const W=this.W,H=this.H;
    this._rb1=this.add.rectangle(W/2-62,H-122,112,44,0x1a3a1a,0.94).setScrollFactor(0).setDepth(52).setInteractive().setStrokeStyle(2,0x44CC44,0.9);
    this._rt1=this.add.text(W/2-62,H-122,'WAIT IT OUT',{fontSize:'13px',color:'#44FF44',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5).setScrollFactor(0).setDepth(53);
    this._rb2=this.add.rectangle(W/2+72,H-122,88,44,0x3a1a1a,0.94).setScrollFactor(0).setDepth(52).setInteractive().setStrokeStyle(2,0xFF4444,0.9);
    this._rt2=this.add.text(W/2+72,H-122,'BARK',{fontSize:'13px',color:'#FF4444',fontFamily:'Fredoka One,sans-serif'}).setOrigin(0.5).setScrollFactor(0).setDepth(53);
    this._rb1.on('pointerdown',()=>this._raccoonWait());
    this._rb2.on('pointerdown',()=>this._raccoonBark());
  }

  _cleanRaccoon(){ [this._rb1,this._rt1,this._rb2,this._rt2].forEach(o=>{if(o)o.destroy();}); }

  _raccoonWait(){
    this._cleanRaccoon(); this.mState='raccoonWait';
    this._cap('Merlin waits. This is extremely hard. Merlin is basically a monk right now.',4000);
    this.time.delayedCall(3400,()=>{
      this.obs.raccoon.done=true; this.obs.raccoon.sprite.destroy();
      this.mState='active';
      this._cap('The raccoon left. Merlin does not trust this but will proceed anyway.',2500);
    });
  }

  _raccoonBark(){
    this._cleanRaccoon();
    try{Audio.boof(0.85);}catch(e){}
    this._cap('Merlin barked. The raccoon did NOT appreciate this. Merlin is retreating.',3000);
    this.mState='stunned';
    this.tweens.add({targets:this.merlin,y:this.merlin.y-130,duration:480,ease:'Power2',
      onComplete:()=>{
        this.mState='active';
        this.obs.raccoon.triggered=false; // allow retry
        this.time.delayedCall(400,()=>this._cap('Merlin has reconsidered. The wait option may be superior.',2500));
      }});
  }

  // ── WIN ───────────────────────────────────────────────────────────────
  _win(){
    this.mState='won';
    if(this._carEvent)this._carEvent.remove();
    if(this._loop)this._loop.remove();
    this._cleanDOM();
    this.cameras.main.stopFollow();
    try{Audio.boof(1.3);}catch(e){}
    this.time.delayedCall(350,()=>{
      this.dlg.show([
        {speaker:'Merlin',text:'Wait.'},
        {speaker:'Merlin',text:'WAIT.'},
        {speaker:'Merlin',text:'That is DAD SMELL.'},
        {speaker:'Merlin',text:'Merlin is going HOME.'},
      ],()=>{
        titleCard(this,'CHAPTER 5','"MERLIN ARRIVES HOME"',()=>{
          this.cameras.main.fadeOut(400);
          this.time.delayedCall(400,()=>this.scene.start('StubScene'));
        });
      });
    });
  }
}

// ── PHASER CONFIG + INIT ───────────────────────────────────────────────────
window.addEventListener('load',()=>{
  const game=window._mgaGame=new Phaser.Game({
    type:Phaser.AUTO, width:GW, height:GH, backgroundColor:'#0a0a0a',
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
    parent:'game-container',
    scene:[BootScene,PrologueScene,Ch1IntroScene,Ch1FPSScene,
           Ch2IntroScene,Ch2DrinkScene,Ch2DrunkScene,
           Ch3IntroScene,Ch3PuzzleScene,Ch3TripScene,
           Ch4GasScene,Ch4NavScene,
           StubScene]
  });

  // ── DEBUG BUTTON ────────────────────────────────────────────────────────
  const chapters=[
    {label:'Boot',          key:'BootScene'},
    {label:'Prologue',      key:'PrologueScene'},
    {label:'Ch1 Intro',     key:'Ch1IntroScene'},
    {label:'Ch1 FPS',       key:'Ch1FPSScene'},
    {label:'Ch2 Bar',       key:'Ch2IntroScene'},
    {label:'Ch2 Drinks',    key:'Ch2DrinkScene'},
    {label:'Ch2 Drunk',     key:'Ch2DrunkScene'},
    {label:'Ch3 Intro',     key:'Ch3IntroScene'},
    {label:'Ch3 Puzzle',    key:'Ch3PuzzleScene'},
    {label:'Ch3 Trip',      key:'Ch3TripScene'},
    {label:'Ch4 Lost',      key:'Ch4GasScene'},
    {label:'Ch4 Nav',       key:'Ch4NavScene'},
    {label:'Stub / Ch5',    key:'StubScene'},
  ];

  const dbgBtn=document.createElement('div');
  dbgBtn.id='dbg-toggle';
  dbgBtn.textContent='D';
  dbgBtn.style.cssText='position:fixed;top:10px;right:10px;z-index:99999;width:28px;height:28px;border-radius:6px;background:rgba(212,168,67,0.9);color:#111;font-family:"Fredoka One",sans-serif;font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;box-shadow:0 2px 8px rgba(0,0,0,0.6);';
  document.body.appendChild(dbgBtn);

  const menu=document.createElement('div');
  menu.id='dbg-menu';
  menu.style.cssText='position:fixed;top:44px;right:10px;z-index:99998;background:rgba(8,8,18,0.97);border:1px solid #D4A843;border-radius:8px;padding:6px;display:none;flex-direction:column;gap:3px;min-width:148px;';

  chapters.forEach(ch=>{
    const b=document.createElement('div');
    b.textContent=ch.label;
    b.style.cssText='padding:7px 10px;border-radius:4px;cursor:pointer;color:#F0EAD8;font-family:Nunito,sans-serif;font-size:13px;background:rgba(255,255,255,0.05);';
    b.onmouseover=()=>b.style.background='rgba(212,168,67,0.22)';
    b.onmouseout =()=>b.style.background='rgba(255,255,255,0.05)';
    b.onclick=()=>{
      menu.style.display='none';
      // Kill FPS overlay
      const fps=document.getElementById('fps-container');
      if(fps)fps.remove();
      // Kill all nav/balance DOM buttons
      document.querySelectorAll('[data-ch3btn],[data-navbtn]').forEach(el=>el.remove());
      // Stop all active scenes
      game.scene.scenes.forEach(s=>{if(s.scene.isActive()||s.scene.isPaused())s.scene.stop();});
      game.scene.start(ch.key);
    };
    menu.appendChild(b);
  });

  document.body.appendChild(menu);
  dbgBtn.onclick=()=>{menu.style.display=menu.style.display==='none'?'flex':'none';};
});
