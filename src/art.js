// Industrial environment and cinematic rendering for Mine Descent.
export class IndustrialArt {
  constructor(T,renderer){this.T=T;this.renderer=renderer;this.dust=[];this.effects=[];this.moving=[];this.roomLights=[];this.materials={};this.sharedGeometries=new Set();this.tex={};this.glows=new Map();this.obstacles=[];this.initMaterials();}
  v(x=0,y=0,z=0){return new this.T.Vector3(x,y,z);}
  texture(url){const T=this.T;let t;if(typeof Image==='function'){t=new T.TextureLoader().load(url);t.userData.path=url;}else{t=new T.DataTexture(new Uint8Array([165,165,165,255]),1,1);t.needsUpdate=true;t.userData.path=url;}t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(8,this.renderer.capabilities?.getMaxAnisotropy?.()||1);return t;}
  material(name,options){const m=new this.T.MeshStandardMaterial(options);m.userData.shared=true;this.materials[name]=m;return m;}
  initMaterials(){const T=this.T;this.tex.rock=this.texture('/rock.jpg');this.tex.metal=this.texture('/metal.jpg');this.material('rock',{color:0x9a948a,map:this.tex.rock,bumpMap:this.tex.rock,bumpScale:.5,roughness:.98,metalness:.06});this.material('armor',{color:0x6c7377,map:this.tex.metal,bumpMap:this.tex.metal,bumpScale:.065,roughness:.62,metalness:.75});this.material('steel',{color:0x848b90,map:this.tex.metal,bumpMap:this.tex.metal,bumpScale:.035,roughness:.42,metalness:.86});this.material('rubber',{color:0x171b1e,roughness:.97,metalness:.12});this.material('brass',{color:0x7a6550,map:this.tex.metal,bumpMap:this.tex.metal,bumpScale:.03,roughness:.67,metalness:.7});this.material('yellow',{color:0x998555,map:this.tex.metal,roughness:.78,metalness:.55});this.material('floor',{color:0x454a49,map:this.tex.metal,bumpMap:this.tex.metal,bumpScale:.14,roughness:.87,metalness:.72});this.material('ceramic',{color:0x4c5455,roughness:.84,metalness:.28});this.material('black',{color:0x090b0d,roughness:.8,metalness:.18});}
  mesh(parent,geo,mat,pos,scale){const m=new this.T.Mesh(geo,mat);if(pos)m.position.copy(pos);if(scale)m.scale.copy(scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  box(parent,pos,size,mat=this.materials.armor){const g=new this.T.BoxGeometry(...size),uv=g.attributes.uv;for(let f=0;f<6;f++){const a=f<2?size[2]:size[0],b=f<2?size[1]:f<4?size[2]:size[1];for(let j=0;j<4;j++){const i=f*4+j;uv.setXY(i,uv.getX(i)*Math.max(a/4,.25),uv.getY(i)*Math.max(b/4,.25));}}return this.mesh(parent,g,mat,this.v(...pos));}
  cylinder(parent,a,b,r,mat=this.materials.steel,segments=10,r2=r){const av=this.v(...a),bv=this.v(...b),d=bv.clone().sub(av);const m=this.mesh(parent,new this.T.CylinderGeometry(r2,r,d.length(),segments),mat,av.clone().add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(this.v(0,1,0),d.normalize());return m;}
  emissive(color,intensity=1){const key=color+':'+intensity;if(this.glows.has(key))return this.glows.get(key);const m=new this.T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.3,metalness:.2});m.userData.shared=true;this.glows.set(key,m);return m;}
  noise(x,y,z=0){return Math.sin(x*.53+y*.78+z*.9)*.52+Math.sin(x*1.37-y*.91+z*.42)*.24+Math.sin(x*3.4+y*2.5-z*1.7)*.1;}
  wall(parent,center,axis,sign,opening,wallList,roomIndex,identity){const T=this.T,other=[0,1,2].filter(i=>i!==axis),normal=this.v();normal.setComponent(axis,-sign);const base=center.clone();base.setComponent(axis,base.getComponent(axis)+sign*18);const root=new T.Group();root.position.copy(base);root.quaternion.setFromUnitVectors(this.v(0,0,1),normal);parent.add(root);const isFloor=axis===1&&sign===-1,isRock=!isFloor&&(['ore','crusher','foundry'].includes(identity?.theme)||(!identity&&roomIndex%3!==1)||axis===0);const addPanel=(u,v,w,h)=>{const block=this.box(root,[u,v,0],[w,h,.8],isRock?this.materials.rock:this.materials.armor);wallList.push(block);if(isRock){const geo=new T.PlaneGeometry(w,h,Math.ceil(w/1.8),Math.ceil(h/1.8)),p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<p.count;i++){const x=p.getX(i)+u,y=p.getY(i)+v;const raised=.48+Math.abs(this.noise(x+center.x,y+center.y,center.z))*1.2;p.setZ(i,raised);uv.setXY(i,x/13,y/13);}geo.computeVertexNormals();const surface=this.mesh(root,geo,this.materials.rock,this.v(u,v,0));wallList.push(surface);}else{for(let x=-w/2+3;x<w/2;x+=6){const seam=this.box(root,[u+x,v,.43],[.035,h,.055],this.materials.black);seam.castShadow=false;}for(let y=-h/2+6;y<h/2;y+=6)this.box(root,[u,v+y,.44],[w,.035,.06],this.materials.black);}};
    if(opening){addPanel(-13.5,0,9,36);addPanel(13.5,0,9,36);addPanel(0,-13.5,18,9);addPanel(0,13.5,18,9);}else addPanel(0,0,36,36);
    // Structural I-beams, bolted collars and small functional guide lamps.
    const perimeter=opening?9.4:16.6;for(const x of [-perimeter,perimeter]){this.box(root,[x,0,1.05],[.8,opening?20:34,1.2],this.materials.armor);this.box(root,[x,0,1.7],[1.4,opening?20:34,.18],this.materials.steel);for(let y=-perimeter;y<=perimeter;y+=5){this.box(root,[x,y,1.9],[1.9,.7,.32],this.materials.rubber);for(const bx of[-.62,.62])this.cylinder(root,[x+bx,y,2],[x+bx,y,2.17],.12,this.materials.steel,6);}}
    if(opening){for(const y of[-9.4,9.4]){this.box(root,[0,y,1.1],[20,1,1.25],this.materials.armor);for(const x of[-7,-5,-3,-1,1,3,5,7]){const s=this.box(root,[x,y,1.78],[.65,.65,.035],this.materials.yellow);s.rotation.z=-.55;}}
      for(const x of[-9.3,9.3]){this.box(root,[x,5,1.83],[.46,3.2,.35],this.materials.black);this.box(root,[x,5,2.03],[.18,2.7,.08],this.emissive(0xb3cbbf,2.4));}
      this.label(root,(identity?.name||'SECTOR '+(roomIndex+1)).toUpperCase(),[0,12,2.2],12,2,identity?.code);}
    else if(!isFloor){this.box(root,[0,-9,1.8],[9,4,1.8],this.materials.rubber);for(let i=0;i<12;i++)this.box(root,[-4+i*.73,-9,2.85],[.16,3.5,.22],this.materials.steel);this.label(root,(identity?.name||'INDUSTRIAL WORKINGS').toUpperCase(),[0,8,2.5],14,2.5,identity?.code);}
    return root;
  }
  label(parent,text,pos,w,h,subtitle='AUTONOMOUS INDUSTRIAL SYSTEMS'){if(typeof document==='undefined'||!document.createElement)return;const T=this.T,c=document.createElement('canvas');c.width=768;c.height=128;const ctx=c.getContext('2d');if(!ctx?.fillText)return;ctx.fillStyle='#111719';ctx.fillRect(0,0,768,128);ctx.fillStyle='#c0b28b';ctx.fillRect(0,0,12,128);ctx.font='bold '+Math.min(42,Math.floor(700/(text.length*.61)))+'px monospace';ctx.fillText(text,30,75);ctx.fillStyle='#676d68';ctx.font='17px monospace';ctx.fillText(subtitle,32,108);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const m=new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.84});m.userData.ownedTexture=tex;this.mesh(parent,new T.PlaneGeometry(w,h),m,this.v(...pos));}
  room(parent,center,index,identity){const T=this.T,r=new T.Group();r.position.copy(center);r.userData.roomIdentity=identity;parent.add(r);const m=this.materials;
    // Two massive ceiling gantry beams carry crane motors and service conduits.
    for(const z of[-11,11]){this.box(r,[0,14.9,z],[32,1.35,1.3],m.armor);this.box(r,[0,14,z],[32,.18,2.3],m.steel);for(const x of[-13,13]){this.box(r,[x,13,z],[3.2,3.2,3.2],m.rubber);this.cylinder(r,[x,12.3,z-1.8],[x,12.3,z+1.8],.8,m.brass,12);}}
    for(const x of[-14,14]){this.cylinder(r,[x,15,-16],[x,15,16],.55,m.steel);this.cylinder(r,[x+1,15.4,-16],[x+1,15.4,16],.22,m.brass);for(let z=-14;z<=14;z+=7){this.box(r,[x,15,z],[2,1.8,.45],m.rubber);}}
    // Suspended work fixtures; actual point lights provide readable pools of light.
    for(const z of[-9,9]){this.box(r,[0,12.7,z],[6,.65,2],m.rubber);this.box(r,[0,12.3,z],[5.2,.08,1.25],this.emissive(index%2?0xd1c5a1:0xb3c8d0,2.4));for(const x of[-2,2])this.cylinder(r,[x,13,z],[x,15.5,z],.045,m.steel);}
    const themeLight={intake:0xccdde6,crusher:0xe6be79,ore:0xb5c797,switchgear:0xa6d7ba,turbine:0xadc8ea,coolant:0x8fbcd0,foundry:0xff864e,workshop:0xffe4b0,freight:0xe2a579,containment:0xffb994};
    const lamp=new T.PointLight(themeLight[identity?.theme]||0xc6dce3,identity?.theme==='foundry'?1550:1250,62,2);lamp.position.copy(center).add(this.v(0,10,0));parent.add(lamp);this.roomLights.push(lamp);lamp.visible=false;
    if(identity?.theme&&identity.theme!=='containment')this.landmarks(r,center,index,identity.theme);
    else{
    // Machinery stays against the shell so the flight volume remains clear.
    for(const sign of[-1,1]){const p=[sign*14,-12,sign*10];this.box(r,p,[4,8,5],m.armor);this.obstacles.push({min:center.clone().add(this.v(p[0]-2.5,-16,p[2]-3)),max:center.clone().add(this.v(p[0]+2.5,-7.5,p[2]+3))});this.box(r,[p[0],-7.8,p[2]],[4.6,.7,5.6],m.steel);for(let i=0;i<5;i++)this.box(r,[p[0]-sign*2.2,-10+i*.7,p[2]],[.12,.3,3.9],m.black);this.cylinder(r,[p[0],-11,p[2]-3],[p[0],-11,p[2]+3],1.6,m.rubber,14);for(const z of[-2.5,2.5])this.cylinder(r,[p[0],-11,p[2]+z-.15],[p[0],-11,p[2]+z+.15],1.8,m.steel,16);}
    }
    // Bedrock ribs and exposed ore fragments interrupt the manufactured silhouette.
    for(let i=0;i<12;i++){const x=(i%2?1:-1)*(15.5+Math.random()),z=-15+(i%6)*6;const rock=this.mesh(r,new T.IcosahedronGeometry(1,1),m.rock,this.v(x,-15.5,z),this.v(1.1+Math.random(),1+Math.random()*1.5,1.5));rock.rotation.set(i*.3,i,.2);}
    for(let i=0;i<3;i++){const z=-12+i*12;this.cable(r,[[-15,13,z],[-13,9,z+2],[-15,4,z+1],[-15,-8,z]],.12,m.rubber);}
    this.dustCloud(parent,center,120,33,0x9ca4a1,.075);return r;
  }
  // Function-specific silhouettes use the corner volumes, leaving all six exits clear.
  landmarks(parent,center,index,theme){
    const T=this.T,m=this.materials;
    const colors={intake:0xbcc9c5,crusher:0xc9a260,ore:0xb38566,switchgear:0x9fac91,turbine:0x97b6cb,coolant:0x7faeaa,foundry:0xe1a064,workshop:0xc4c0a6,freight:0xa8795f};
    const light=this.emissive(colors[theme],1.15);
    for(const [side,sign]of [-1,1].entries()){
      const zSign=(index%2?-1:1)*sign,x=sign*14,z=zSign*14,g=new T.Group();g.position.set(x,0,z);parent.add(g);g.userData.landmark=theme;
      const b=(p,size,mat=m.armor)=>this.box(g,p,size,mat);
      const pipe=(a,c,r,mat=m.steel,n=12,r2=r)=>this.cylinder(g,a,c,r,mat,n,r2);
      const height={intake:19,crusher:22,ore:13,switchgear:21,turbine:15,coolant:23,foundry:13,workshop:16,freight:side?22:15}[theme];
      this.obstacles.push({min:center.clone().add(this.v(x-3,-16,z-3)),max:center.clone().add(this.v(x+3,-16+height,z+3))});
      b([0,-15.3,0],[5.6,1,5.6],m.rubber);
      if(theme==='coolant'){
        pipe([0,-14,0],[0,5,0],2.2,m.ceramic,20);for(const y of[-13,-8,-2,4])pipe([0,y-.15,0],[0,y+.15,0],2.42,m.steel,20);
        for(const sx of[-2.5,2.5]){pipe([sx,-14,0],[sx,3,0],.25,m.brass);pipe([sx,3,0],[0,3,0],.25,m.brass);}
        b([0,-2,-2.25],[1.4,3,.2],m.black);b([0,-2,-2.38],[.15,2.5,.06],light);
      }else if(theme==='switchgear'){
        for(const sx of[-1.85,0,1.85]){b([sx,-5,0],[1.65,20,4]);b([sx,-4,-2.05],[1.35,17,.12],m.rubber);for(const y of[-10,-6,-2,2]){b([sx,y,-2.14],[1.15,.08,.08],m.steel);b([sx-.35,y+.4,-2.15],[.12,.2,.07],light);}b([sx+.4,-4,-2.3],[.12,1,.2],m.steel);}
        for(const dz of[-1,1])b([0,4.6,dz],[5.7,.25,.35],m.brass);
      }else if(theme==='turbine'){
        b([0,-12,0],[4.7,5,5]);pipe([0,-6,-2.4],[0,-6,2.4],2.75,m.rubber,24);
        for(const face of[-1,1]){pipe([0,-6,face*2.3],[0,-6,face*2.5],2.8,m.steel,24);pipe([0,-6,face*2.51],[0,-6,face*2.56],2.35,m.black,24);pipe([0,-6,face*2.55],[0,-6,face*2.8],.55,m.brass,16);}
        b([0,-1.6,0],[3,.6,4],m.steel);
      }else if(theme==='crusher'){
        for(const sx of[-2,2]){b([sx,-5,0],[1.3,20,5]);for(let i=0;i<7;i++)b([sx,-13+i*2.6,0],[1.55,.28,5.3],m.steel);}
        b([0,4,0],[5.5,1.8,5.4],m.yellow);b([0,-8,0],[2.4,10,4],m.black);
        for(const y of[-10,-5]){pipe([-1.4,y,0],[1.4,y,0],1.6,m.steel,12);for(let i=0;i<8;i++){const a=i*Math.PI/4,teeth=b([0,y+Math.sin(a)*1.55,Math.cos(a)*1.55],[2.9,.6,.6],m.brass);teeth.rotation.x=-a;}}
      }else if(theme==='ore'){
        pipe([0,-13,0],[0,-5,0],1.3,m.brass,6,2.65);for(const sx of[-2.3,2.3])for(const sz of[-2.3,2.3])b([sx,-11,sz],[.4,8,.4],m.steel);
        pipe([0,-5.2,0],[0,-4.8,0],2.75,m.steel,6);
        for(let i=0;i<6;i++){const rock=this.mesh(g,new T.IcosahedronGeometry(.8+(i%3)*.17,0),m.rock,this.v(Math.sin(i*2.4)*1.25,-5+(i%2)*.8,Math.cos(i*2.4)*1.25));rock.rotation.set(i,i*.4,.3);}
        b([0,-13.3,0],[2,1,5.3],m.rubber);
      }else if(theme==='foundry'){
        b([0,-10,0],[5.5,10,5.5]);for(const face of[-1,1]){b([0,-10,face*2.8],[3.9,6,.12],m.black);for(const y of[-12,-10,-8])b([0,y,face*2.88],[3.3,.7,.06],light);for(const sx of[-2.2,2.2])b([sx,-10,face*2.95],[.35,8,.1],m.steel);}
        for(const sx of[-2,-1,0,1,2])b([sx,-4.8,0],[.15,2.4,5.1],m.steel);
      }else if(theme==='workshop'){
        for(const sx of[-2.2,2.2])b([sx,-12,0],[.6,6,4.5],m.steel);b([0,-8.8,0],[5.6,.65,5.2],m.steel);
        b([0,-4.5,2.3],[5.4,8,.4],m.rubber);for(let i=0;i<5;i++)b([-2+i,-4+(i%2),2],[.2,3,.5],m.brass);
        pipe([-1,-8,0],[-1,-4,0],.6,m.yellow);pipe([-1,-4,0],[1,-1,0],.48,m.yellow);pipe([1,-1,0],[2,-3,0],.38,m.steel);
        for(const sx of[1.65,2.35])b([sx,-3.5,0],[.25,1,.4],m.steel);b([-1,-7,-1.2],[1.5,2,1.2],m.rubber);
      }else if(theme==='freight'){
        const stacks=side?3:2;for(let n=0;n<stacks;n++){const y=-12+n*7;b([0,y,0],[5.4,6.5,5.2],n%2?m.brass:m.armor);for(const face of[-1,1])for(let i=0;i<6;i++)b([-2.15+i*.86,y,face*2.67],[.16,5.8,.14],m.steel);for(const x of[-2.4,2.4])b([x,y,0],[.25,6.7,5.4],m.rubber);b([0,y,-2.82],[1.5,.4,.08],light);}
      }else{
        // Intake docking jaw: a tall C-clamp around a heavy hydraulic compressor.
        b([0,-6,1.8],[5.4,18,1.5],m.steel);for(const y of[-13,1])b([0,y,0],[5.5,2,5.5],m.armor);
        for(const sx of[-1.5,1.5]){pipe([sx,-12,0],[sx,-2,0],.75,m.rubber);pipe([sx,-2,0],[sx,1,0],.38,m.steel);}
        b([0,-3,-1.5],[4.8,1.8,2.3],m.yellow);for(const sx of[-1.5,0,1.5])b([sx,-3,-2.7],[.5,1.8,.2],m.black);
      }
      b([0,-14.5,-2.88],[1.7,.18,.08],light);
    }
  }
  cable(parent,points,r=.08,mat=this.materials.rubber){const T=this.T,path=new T.CatmullRomCurve3(points.map(p=>this.v(...p)));return this.mesh(parent,new T.TubeGeometry(path,24,r,6,false),mat);}
  tunnel(parent,a,b){const T=this.T,delta=b.clone().sub(a),axis=delta.x?0:delta.y?1:2,other=[0,1,2].filter(i=>i!==axis),center=a.clone().add(b).multiplyScalar(.5),g=new T.Group();g.position.copy(center);g.quaternion.setFromUnitVectors(this.v(0,0,1),delta.clone().normalize());parent.add(g);for(const z of[-5,0,5]){for(const x of[-8.45,8.45])this.box(g,[x,0,z],[.32,17.1,.7],this.materials.steel);for(const y of[-8.45,8.45])this.box(g,[0,y,z],[17.1,.32,.7],this.materials.steel);for(const s of[-1,1]){const bevel=this.box(g,[s*7.7,7.7,z],[2,.5,.7],this.materials.armor);bevel.rotation.z=s*.78;}}
    for(const x of[-7,7]){this.cylinder(g,[x,7,-7.4],[x,7,7.4],.2,this.materials.brass);this.cylinder(g,[x+.5,7.5,-7.4],[x+.5,7.5,7.4],.13,this.materials.rubber);this.box(g,[x,5.5,0],[.32,.18,3.2],this.emissive(0xc7b887,1.8));}
    return g;
  }
  reactor(parent,pos){const T=this.T,m=this.materials,g=new T.Group();g.position.copy(pos);parent.add(g);this.cylinder(g,[0,-13,0],[0,-10,0],7.4,m.armor,16);this.cylinder(g,[0,-10,0],[0,-7,0],5.9,m.rubber,16);this.cylinder(g,[0,9,0],[0,12,0],7,m.armor,16);const core=this.mesh(g,new T.CylinderGeometry(2.8,2.8,12,24),this.emissive(0xffb774,2.8));
    for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.sin(a)*5,z=Math.cos(a)*5;this.cylinder(g,[x,-10,z],[x,10,z],.58,m.steel,10);this.cylinder(g,[x*1.22,-13,z*1.22],[x*1.22,12,z*1.22],.18,m.brass,8);for(const y of[-8,8]){const plate=this.box(g,[x,y,z],[2.5,3.6,1],m.armor);plate.rotation.y=a;}this.box(g,[x*.73,0,z*.73],[.22,9,.22],this.emissive(0xe59652,1.5));}
    for(const y of[-7,-3,3,7]){const ring=this.mesh(g,new T.TorusGeometry(5.8,.42,8,48),m.steel,this.v(0,y,0));ring.rotation.x=Math.PI/2;}
    const shield=this.mesh(g,new T.CylinderGeometry(6.1,6.1,17,32,1,true),new T.MeshBasicMaterial({color:0x6dacc3,transparent:true,opacity:.09,side:T.DoubleSide}));this.label(g,'CORE / PRESSURE VESSEL',[0,-11,7.7],7,1.4);return {group:g,core,shield};
  }
  pickup(parent,pos,type,tint){
    const T=this.T,m=this.materials,g=new T.Group();g.position.copy(pos);parent.add(g);
    const weapon=type==='cannon',ammo=type==='cannonAmmo',color=tint??(type==='reactorKey'?0xffbc60:type==='shield'?0x96c7e1:type==='missile'?0xd9ab67:0xb7c792);
    if(type==='reactorKey'){
      const gold=new T.MeshStandardMaterial({color:0xffc52e,metalness:.82,roughness:.24,emissive:0x865200,emissiveIntensity:.65});
      const bow=this.mesh(g,new T.TorusGeometry(1.5,.36,12,40),gold,this.v(0,1.4,0));bow.userData.keyPart='bow';
      this.cylinder(g,[0,.15,0],[0,-3.5,0],.27,gold,12).userData.keyPart='shaft';
      this.box(g,[.6,-2.4,0],[1.5,.5,.6],gold).userData.keyPart='tooth';
      this.box(g,[.45,-3.2,0],[1.2,.55,.6],gold).userData.keyPart='tooth';
      this.cylinder(g,[0,-.4,0],[0,-.1,0],.44,gold,16);
      return g;
    }
    this.box(g,[0,0,0],weapon?[3.6,1.7,2.6]:[2.6,1.5,1.8],m.armor);
    this.box(g,[0,.8,0],weapon?[3.9,.2,2.8]:[2.9,.2,2],m.rubber);
    for(const x of[-1,1])this.box(g,[x*(weapon?1.65:1),0,0],[.2,1.7,weapon?2.8:2],m.steel);
    const light=this.emissive(color,2.5);this.box(g,[0,.15,weapon?1.4:1],[.9,.25,.05],light);
    if(weapon){
      this.box(g,[0,1.35,0],[1.1,.8,1.8],m.steel);
      for(const x of[-.38,.38]){this.cylinder(g,[x,1.4,-.4],[x,1.4,-2.4],.23,m.steel,10);this.cylinder(g,[x,1.4,-2.1],[x,1.4,-2.5],.15,light,8);}
      for(const x of[-1.4,1.4])this.box(g,[x,1,0],[.15,.25,2.2],light);
    }else if(ammo){
      for(const x of[-.7,0,.7]){this.cylinder(g,[x,.95,-.6],[x,.95,.6],.22,m.steel,8);this.cylinder(g,[x,.95,.4],[x,.95,.65],.23,light,8);}
    }else if(type==='shield'){
      const ring=new T.Mesh(new T.TorusGeometry(1.8,.09,6,32),light);ring.rotation.x=Math.PI/2;ring.position.y=1.4;g.add(ring);
      for(const x of[-1.05,1.05])this.box(g,[x,.1,1.02],[.15,1.15,.08],light);
    }else if(type==='missile')for(const x of[-.7,0,.7])this.cylinder(g,[x,1,-.65],[x,1,.65],.18,m.brass,8);
    return g;
  }
  cockpit(camera){const T=this.T,m=this.materials,g=new T.Group();camera.add(g);const armor=m.armor.clone();armor.color.setHex(0x384044);armor.userData.shared=true;const screen=this.emissive(0x496b67,.5);
    for(const s of[-1,1]){const rail=this.box(g,[s*.95,-.63,-1.13],[.2,.19,1.9],armor);rail.rotation.z=-s*.22;const pillar=this.box(g,[s*1.12,-.27,-1.2],[.05,.82,.12],m.rubber);pillar.rotation.z=-s*.3;this.box(g,[s*.76,-.52,-1.82],[.19,.15,.7],armor);for(const x of[-.065,.065])this.cylinder(g,[s*.76+x,-.48,-1.9],[s*.76+x,-.48,-2.22],.025,m.steel,8);this.box(g,[s*.58,-.69,-1.1],[.35,.15,.32],armor);const panel=this.box(g,[s*.58,-.603,-1.1],[.27,.009,.22],screen);panel.rotation.x=.12;for(let i=0;i<5;i++)this.box(g,[s*.75,-.59,-.85-i*.08],[.02,.025,.015],this.emissive(i===0?0xb47742:0x91a6a0,.7));this.cable(g,[[s*1,-.6,-.8],[s*.87,-.55,-1.1],[s*.85,-.65,-1.7]],.018,m.rubber);}
    this.box(g,[0,-.83,-1.08],[2,.23,.4],armor);this.box(g,[0,-.7,-1.1],[.35,.06,.23],m.rubber);this.box(g,[0,-.665,-1.1],[.24,.012,.15],screen);return g;
  }
  dustCloud(parent,center,count=100,size=30,color=0x9ca4a1,opacity=.1){const T=this.T,geo=new T.BufferGeometry(),pos=new Float32Array(count*3);for(let i=0;i<count;i++){pos[i*3]=(Math.random()-.5)*size;pos[i*3+1]=(Math.random()-.5)*size;pos[i*3+2]=(Math.random()-.5)*size;}geo.setAttribute('position',new T.BufferAttribute(pos,3));const mat=new T.PointsMaterial({color,size:.055,transparent:true,opacity,depthWrite:false});const points=new T.Points(geo,mat);points.position.copy(center);parent.add(points);this.dust.push(points);}
  // Effects are added after static batching and outside collision groups.
  roomEffects(parent,centers,identities){
    const T=this.T,m=this.materials;
    if(!this.mistTexture){
      const size=32,data=new Uint8Array(size*size*4);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,r=Math.hypot((x-15.5)/16,(y-15.5)/16);data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.pow(Math.max(0,1-r),2)*255;}
      this.mistTexture=new T.DataTexture(data,size,size);this.mistTexture.needsUpdate=true;
    }
    for(const [index,center]of centers.entries()){
      const theme=identities[index].theme,root=new T.Group();root.position.copy(center);root.userData.roomEffect=theme;parent.add(root);
      const color={intake:0xc7e0ee,crusher:0xb59d75,ore:0xb7a580,switchgear:0x99dfff,turbine:0xa8cbeb,coolant:0x8acbd9,foundry:0xff9a42,workshop:0xffd69a,freight:0xffb24f,containment:0xa2b6ff}[theme];
      const glow=this.emissive(color,1.8).clone();glow.userData.shared=false;
      const system={root,center:center.clone(),theme,index,phase:index*1.731,motions:[],glow};
      const addMotion=(object,kind,rate=1)=>{system.motions.push({object,kind,rate,base:object.position.clone()});return object;};
      for(const [side,sign]of [-1,1].entries()){
        const x=sign*14,z=(index%2?-1:1)*sign*14;
        if(theme==='turbine'){
          for(const face of[-1,1]){const rotor=new T.Group();rotor.position.set(x,-6,z+face*2.66);root.add(rotor);
            for(let i=0;i<9;i++){const a=i*Math.PI*2/9,blade=this.box(rotor,[Math.sin(a)*1.25,Math.cos(a)*1.25,0],[.72,2.3,.12],m.steel);blade.rotation.z=-a+.3;}
            addMotion(rotor,'spin',sign*(1.6+index%3*.25));
          }
        }else if(theme==='crusher'){
          addMotion(this.box(root,[x,-5,z],[2.7,1.8,4.2],m.steel),'piston',1.1+side*.1);
        }else if(theme==='ore'){
          for(let i=0;i<4;i++)addMotion(this.mesh(root,new T.IcosahedronGeometry(.45+i*.07,0),m.rock,this.v(x+Math.sin(i*2)*1.2,4-i*2,z+Math.cos(i*2)*1.2)),'oreChunk',.18+i*.013);
        }else if(theme==='coolant'){
          addMotion(this.box(root,[x,-2,z-2.43],[.35,2.6,.08],glow),'fluid',.7);
          this.cylinder(root,[x,5,z],[x-sign*2,5,z],.3,m.steel);
        }else if(theme==='foundry'){
          for(const face of[-1,1])this.box(root,[x,-10,z+face*2.94],[3.3,4.6,.04],glow);
        }else if(theme==='switchgear'){
          const points=[];for(let i=0;i<9;i++)points.push(this.v(x-2.5+i*.625,5.4+(i%2?-.45:.45),z));
          const arc=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0xb2e7ff,transparent:true,opacity:.8,depthWrite:false}));root.add(arc);addMotion(arc,'arc',1);
        }else if(theme==='workshop'){
          const tool=new T.Group();tool.position.set(x+2,-3,z);root.add(tool);this.cylinder(tool,[0,0,0],[0,-1.5,0],.18,m.steel);this.box(tool,[0,-1.5,0],[.22,.3,.22],glow);addMotion(tool,'weld',.6);
        }else if(theme==='containment'){
          const ring=this.mesh(root,new T.TorusGeometry(2.5,.08,6,32),glow,this.v(x,9,z));ring.rotation.x=.65;addMotion(ring,'containment',.35);
        }else{
          const scan=this.box(root,[x,theme==='freight'?3:-5,z],[5.8,.08,5.8],new T.MeshBasicMaterial({color,transparent:true,opacity:.22,depthWrite:false,side:T.DoubleSide}));addMotion(scan,theme==='freight'?'cargoScan':'dockScan',.55);
        }
      }
      const mist=['intake','crusher','ore','turbine','coolant'].includes(theme);
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(32*3),3));
      const particles=new T.Points(geo,new T.PointsMaterial({color,size:mist?(theme==='coolant'?2.6:theme==='intake'?1.8:.7):.14,transparent:true,opacity:mist?.28:.8,map:mist?this.mistTexture:null,depthWrite:false,blending:mist?T.NormalBlending:T.AdditiveBlending}));root.add(particles);system.particles=particles;
      root.traverse(o=>{o.castShadow=false;o.receiveShadow=false;o.raycast=()=>{};});root.visible=false;this.moving.push(system);
    }
  }
  updateRoomEffects(t){
    for(const s of this.moving){
      if(!s.root.visible)continue;const clock=t+s.phase;
      s.glow.emissiveIntensity=s.theme==='foundry'?1.8+.55*Math.sin(clock*2.7)+.2*Math.sin(clock*7):s.theme==='containment'?1.5+.45*Math.sin(clock*1.2):1.8;
      for(const motion of s.motions){const o=motion.object,w=clock*motion.rate;
        if(motion.kind==='spin')o.rotation.z=w;
        else if(motion.kind==='piston')o.position.y=motion.base.y+Math.sin(w*2)*1.7;
        else if(motion.kind==='oreChunk'){o.position.y=5-((w+motion.base.y*.11)%1)*10;o.rotation.set(w*2,w*3,w);}
        else if(motion.kind==='fluid'){o.scale.y=.6+.35*Math.sin(w);o.position.y=motion.base.y+(o.scale.y-1)*1.3;}
        else if(motion.kind==='arc'){o.visible=(clock%4.2)<.13;o.material.opacity=.7+.25*Math.sin(clock*70);}
        else if(motion.kind==='weld')o.rotation.z=Math.sin(w)*.45;
        else if(motion.kind==='containment'){o.rotation.y=w;o.rotation.z=w*.5;}
        else o.position.y=motion.base.y+Math.sin(w)*(motion.kind==='cargoScan'?4:6);
      }
      const p=s.particles.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        const sign=i%2?1:-1,x=sign*14,z=(s.index%2?-1:1)*sign*14,k=i*.6180339887;
        const progress=((clock*(s.theme==='ore'?.22:s.theme==='workshop'?.8:.3)+k)%1+1)%1,spread=Math.sin(k*29)*progress;
        let px=x,py=0,pz=z;
        if(s.theme==='coolant'||s.theme==='intake'){px-=sign*progress*5;py=(s.theme==='coolant'?5:1)+Math.sin(k*18)*progress*1.5;pz+=Math.cos(k*19)*progress*1.6;}
        else if(s.theme==='ore'||s.theme==='crusher'){px+=Math.sin(k*23)*1.8;py=(s.theme==='ore'?6:-2)-progress*12;pz+=Math.cos(k*19)*1.8;}
        else if(s.theme==='foundry'){px+=spread*2;py=-8+progress*12;pz+=Math.cos(k*13)*progress*2;}
        else if(s.theme==='workshop'){px+=2+spread*2;py=-4.5+progress*2-progress*progress*6;pz+=Math.cos(k*17)*progress*2;}
        else if(s.theme==='turbine'){px+=Math.sin(k*17)*2;py=-6+Math.cos(k*13)*2;pz+=(i%4<2?-1:1)*(3+progress*4);}
        else if(s.theme==='containment'){px+=Math.sin(clock+k*6.28)*2.5;py=9+Math.cos(clock+k*6.28)*2.5;pz+=Math.sin(clock*.5)*1.6;}
        else{px+=Math.sin(k*23)*2.5;py=-11+progress*15;pz+=Math.cos(k*17)*2.5;}
        p.setXYZ(i,px,py,pz);
      }
      p.needsUpdate=true;
      // Bound is stable while particles move; frustum culling must not use their initial zeros.
      if(!s.particles.geometry.boundingSphere)s.particles.geometry.boundingSphere=new this.T.Sphere(this.v(),30);
      s.particles.visible=s.theme!=='switchgear'||clock%4.2<.18;
    }
  }
  reset(){this.dust=[];this.effects=[];this.moving=[];this.obstacles=[];this.roomLights=[];}
  burst(parent,pos,scale,color){if(scale<.6)return;const T=this.T;if(!this.flareTexture){const n=64,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const d=Math.hypot((x-n/2)/(n/2),(y-n/2)/(n/2)),i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.max(0,Math.pow(1-Math.min(1,d),2.2)*255);}this.flareTexture=new T.DataTexture(data,n,n);this.flareTexture.needsUpdate=true;}for(let i=0;i<6;i++){const smoke=i>1,m=new T.SpriteMaterial({map:this.flareTexture,color:smoke?0x41403a:color,transparent:true,opacity:smoke?.24:.9,blending:smoke?T.NormalBlending:T.AdditiveBlending,depthWrite:false});const sprite=new T.Sprite(m);sprite.position.copy(pos).add(this.v((Math.random()-.5)*scale,(Math.random()-.5)*scale,(Math.random()-.5)*scale));sprite.scale.setScalar(scale*(smoke?4:3));parent.add(sprite);this.effects.push({sprite,life:smoke?2.5:.25,max:smoke?2.5:.25,smoke,scale});}}
  updateLighting(pos){
    const near=[...this.roomLights].sort((a,b)=>a.position.distanceToSquared(pos)-b.position.distanceToSquared(pos)).slice(0,4);
    for(const light of this.roomLights)light.visible=near.includes(light);
    for(const system of this.moving)system.root.visible=system.center.distanceToSquared(pos)<85*85;
  }
  blocked(p,r){for(const b of this.obstacles){const closest=p.clone().clamp(b.min,b.max);if(closest.distanceToSquared(p)<r*r)return true;}return false;}
  batchEnvironment(root){const T=this.T,groups=new Map();root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh||o.material.transparent||Array.isArray(o.material))return;const e=o.matrixWorld.elements,key=o.material.uuid+':'+[e[12],e[13],e[14]].map(n=>Math.round(n/50)).join(',');if(!groups.has(key))groups.set(key,{mat:o.material,objects:[]});groups.get(key).objects.push(o);});for(const {mat,objects}of groups.values()){if(objects.length<3)continue;const vertices=[],normals=[],uvs=[];for(const o of objects){const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;for(let i=0;i<p.count;i++){vertices.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n?.getX(i)||0,n?.getY(i)||1,n?.getZ(i)||0);uvs.push(uv?.getX(i)||0,uv?.getY(i)||0);}g.dispose();o.visible=false;}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));const merged=new T.Mesh(g,mat);merged.receiveShadow=true;merged.castShadow=true;merged.userData.batch=true;root.add(merged);}}
  update(t,dt){this.updateRoomEffects(t);for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;e.sprite.scale.multiplyScalar(1+dt*(e.smoke?.5:4));e.sprite.material.opacity=(e.smoke?.24:.9)*Math.max(0,e.life/e.max);e.sprite.position.y+=dt*(e.smoke?.8:0);if(e.life<=0){e.sprite.parent?.remove(e.sprite);e.sprite.material.dispose();this.effects.splice(i,1);}}for(const d of this.dust){d.rotation.y=Math.sin(t*.035)*.03;d.position.y+=Math.sin(t*.2)*dt*.025;}}
}

export class CinematicPass {
  constructor(T,renderer,width,height){this.T=T;this.renderer=renderer;this.target=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,depthBuffer:true});this.target.texture.colorSpace=T.LinearSRGBColorSpace;this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,0,1);this.uniforms={image:{value:this.target.texture},resolution:{value:new T.Vector2(width,height)},clock:{value:0},strength:{value:1}};this.material=new T.ShaderMaterial({uniforms:this.uniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;uniform sampler2D image;uniform vec2 resolution;uniform float clock;uniform float strength;varying vec2 uv0;
vec3 bright(vec2 uv){vec3 c=texture2D(image,uv).rgb;return max(c-vec3(1.0),0.0);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec2 uv=uv0,px=1./resolution;vec3 c=texture2D(image,uv).rgb;vec3 bloom=vec3(0.);for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 v=vec2(cos(a),sin(a));bloom+=bright(uv+v*px*3.)*.032;bloom+=bright(uv+v*px*9.)*.021;bloom+=bright(uv+v*px*22.)*.008;}c+=bloom*strength;c=aces(c*1.12);float vignette=1.-.32*pow(length((uv-.5)*vec2(1.1,1.)),1.4);c*=vignette;float grain=fract(sin(dot(uv*resolution+fract(clock)*1.7,vec2(12.9898,78.233)))*43758.5453)-.5;c+=grain*.008;c=pow(max(c,0.),vec3(1./2.2));gl_FragColor=vec4(c,1.);}`});this.scene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.material));}
  resize(w,h){this.target.setSize(w,h);this.uniforms.resolution.value.set(w,h);}
  render(scene,camera,t){const r=this.renderer,tm=r.toneMapping;r.toneMapping=this.T.NoToneMapping;r.setRenderTarget(this.target);r.clear();r.render(scene,camera);r.setRenderTarget(null);this.uniforms.clock.value=t;r.toneMapping=tm;r.render(this.scene,this.camera);}
}
