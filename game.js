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
    fanfare() { init(); [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.18,'square',0.28),i*130)); }
  };
})();

// ── DIALOGUE ───────────────────────────────────────────────────────────────
class Dialogue {
  constructor(scene) {
    this.scene=scene; this.active=false; this.queue=[]; this.onDone=null;
    this._full=''; this._done=false; this._timer=null;
    const W=scene.scale.width, H=scene.scale.height, PH=155;
    this.bg  =scene.add.rectangle(0,H-PH,W,PH,0x080808,0.92).setOrigin(0,0).setDepth(200).setVisible(false);
    this.bar =scene.add.rectangle(0,H-PH,W,3,0xD4A843).setOrigin(0,0).setDepth(201).setVisible(false);
    this.spk =scene.add.text(18,H-PH+14,'',{fontSize:'12px',color:'#D4A843',fontFamily:'Fredoka One,sans-serif',letterSpacing:3}).setDepth(202).setVisible(false);
    this.body=scene.add.text(18,H-PH+36,'',{fontSize:'15px',color:'#F0EAD8',fontFamily:'Nunito,sans-serif',wordWrap:{width:W-36},lineSpacing:5}).setDepth(202).setVisible(false);
    this.hint=scene.add.text(W-16,H-16,'▶',{fontSize:'13px',color:'#D4A843'}).setOrigin(1,1).setDepth(202).setVisible(false);
    scene.tweens.add({targets:this.hint,alpha:0.15,duration:550,yoyo:true,repeat:-1});
    scene.input.on('pointerdown',()=>this._tap());
  }
  show(lines,onDone) {
    this.queue=(Array.isArray(lines)?lines:[lines]).slice();
    this.onDone=onDone; this.active=true; this._next();
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
    if (!this.active) return;
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

  make('mom',74,138,g=>{
    g.fillStyle(0x4466BB,1);g.fillRoundedRect(12,92,18,36,4);g.fillRoundedRect(34,92,18,36,4);
    g.fillStyle(0xE87878,1);g.fillRoundedRect(10,40,54,56,6);
    g.fillStyle(0xF5C8A0,1);g.fillRoundedRect(2,42,12,42,5);g.fillRoundedRect(60,42,12,42,5);
    g.fillStyle(0xF5C8A0,1);g.fillCircle(37,26,23);
    g.fillStyle(0x2a1800,1);g.fillCircle(37,15,19);g.fillRect(15,15,44,16);
    g.fillStyle(0x3a2a1a,1);g.fillCircle(28,27,4);g.fillCircle(46,27,4);
    g.fillStyle(0xFFFFFF,1);g.fillCircle(30,25,1.5);g.fillCircle(48,25,1.5);
    g.lineStyle(2,0x3a2a1a,1);g.beginPath();g.arc(37,31,7,0.2,Math.PI-0.2);g.strokePath();
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
        this.time.delayedCall(400,()=>this.scene.start('StubScene'));
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

// ── PHASER CONFIG + INIT ───────────────────────────────────────────────────
window.addEventListener('load',()=>{
  new Phaser.Game({
    type: Phaser.AUTO,
    width: GW,
    height: GH,
    backgroundColor: '#0a0a0a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    parent: 'game-container',
    scene: [BootScene, PrologueScene, Ch1IntroScene, Ch1FPSScene, StubScene]
  });
});
