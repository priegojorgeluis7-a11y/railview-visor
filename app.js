import {isViewable} from './eligibility.js';
import {panoramaMaterial} from './panorama-material.js';
import {headingDelta} from './navigation.js';
import {setupProject} from './project.js';
import {distance,bearing} from './geo.js';
import * as THREE from './vendor/three.module.js';
const $=id=>document.getElementById(id);let catalog,stations,index=0,yaw=0,pitch=-15,viewer,scene,camera,sphere,texture,loadToken=0,map,markers=[];let state={version:0,layers:[],calibrations:{}};
let inventory=[];let project;const rad=Math.PI/180;
function resize(){let r=$('panorama').getBoundingClientRect();viewer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}
function animate(){requestAnimationFrame(animate);const g=stations[index]?.geometry;const top=g?g.vOffset+g.vaov/2:25;const bottom=g?g.vOffset-g.vaov/2:-90;pitch=Math.max(bottom<=-89?-85:bottom+camera.fov/2,Math.min(top-camera.fov/2-1,pitch));camera.lookAt(Math.sin(yaw*rad)*Math.cos(pitch*rad),Math.sin(pitch*rad),-Math.cos(yaw*rad)*Math.cos(pitch*rad));camera.updateMatrixWorld();project?.frame();viewer.render(scene,camera);$('compass').style.transform=`rotate(${-yaw}deg)`}
const textureCache=new Map(),textureURLs=new Map();let navigating=false;
async function getTexture(s){if(textureURLs.get(s.id)!==s.image){const old=textureCache.get(s.id);textureCache.delete(s.id);old?.then(t=>{if(t!==texture)t.dispose()}).catch(()=>{});textureURLs.set(s.id,s.image)}if(!textureCache.has(s.id)){const promise=new THREE.TextureLoader().loadAsync(s.image).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;return t}).catch(e=>{textureCache.delete(s.id);throw e});textureCache.set(s.id,promise)}return textureCache.get(s.id)}
function prefetch(){const keep=new Set([stations[index]?.id,stations[index-1]?.id,stations[index+1]?.id]);for(const [id,p] of textureCache)if(!keep.has(id)){textureCache.delete(id);p.then(t=>{if(t!==texture)t.dispose()}).catch(()=>{})}for(const i of [index-1,index+1])if(stations[i])getTexture(stations[i]).catch(()=>{})}
function panoramaGeometry(s){const g=s.geometry||{haov:360,vaov:180,vOffset:0};const geometry=new THREE.SphereGeometry(50000,128,64,(180-g.haov/2)*rad,g.haov*rad,(90-g.vOffset-g.vaov/2)*rad,g.vaov*rad);geometry.scale(-1,1,1);return geometry}
async function selectStation(i,force=false){
 if(navigating)return;i=Math.max(0,Math.min(stations.length-1,i));if(texture&&i===index&&!force)return;
 navigating=true;const previous=stations[index],s={...stations[i]};const timer=setTimeout(()=>{$('loading').hidden=false;$('loading').textContent='Preparando siguiente panorámica…'},250);
 try{try{const response=await fetch(`./panoramas/${s.id}.json`,{cache:'no-store'});if(response.ok){const details=await response.json();if(JSON.stringify(s.geometry)!==JSON.stringify(details.geometry)){const cached=textureCache.get(s.id);textureCache.delete(s.id);cached?.then(t=>{if(t!==texture)t.dispose()}).catch(()=>{})}s.geometry=details.geometry;s.image=details.image}}catch{}const next=await getTexture(s);clearTimeout(timer);$('loading').hidden=true;
 if(texture&&!force&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const startYaw=yaw,delta=headingDelta(yaw,bearing(previous,s)),startPitch=pitch;const targetPitch=Math.max(-65,Math.min(-8,Math.atan2(-previous.heightAboveTakeoff,Math.max(1,distance(previous,s)))/rad));const begin=performance.now();document.body.classList.add('travelling');await new Promise(resolve=>{function turn(now){const t=Math.min(1,(now-begin)/500),e=t*t*(3-2*t);yaw=startYaw+delta*e;pitch=startPitch+(targetPitch-startPitch)*e;if(t<1)requestAnimationFrame(turn);else resolve()}requestAnimationFrame(turn)})}else if(texture&&!force){yaw=bearing(previous,s)}
 const outgoing=texture&&!force?new THREE.Mesh(sphere.geometry.clone(),panoramaMaterial(previous.geometry,texture)):null;
 if(outgoing){outgoing.rotation.copy(sphere.rotation);outgoing.renderOrder=1;scene.add(outgoing)}
 stations[i]=s;index=i;
 $('stationName').textContent=s.name;$('stationDate').textContent=s.date.slice(0,10).replaceAll(':','-')+' · '+s.date.slice(11);$('position').textContent=`${s.lat.toFixed(6)}° N · ${Math.abs(s.lon).toFixed(6)}° O`;$('altitude').textContent=`Altitud GPS ${s.alt.toFixed(1)} m · ${s.frameCount} tomas`;$('step').textContent=`${String(index+1).padStart(2,'0')} / ${stations.length}`;$('coverageBadge').textContent=s.partial?'COBERTURA PARCIAL':'360°';$('prev').disabled=index===0;$('next').disabled=index===stations.length-1;document.querySelectorAll('.station').forEach((el,j)=>el.classList.toggle('selected',j===index));markers.forEach((m,j)=>m.setStyle({fillColor:j===index?'#d3f76b':'#1a3540',radius:j===index?8:5,color:j===index?'#fff':'#cee87b'}));map.panTo([s.lat,s.lon]);project?.selected();history.replaceState(null,'','#'+s.id);
 sphere.geometry.dispose();sphere.geometry=panoramaGeometry(s);texture=next;sphere.material.dispose();sphere.material=panoramaMaterial(s.geometry,next);
 if(outgoing&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.body.classList.add('travelling');const angle=bearing(previous,s)*rad;const dx=Math.sin(angle),dz=-Math.cos(angle);const fov=camera.fov;const begin=performance.now();await new Promise(resolve=>{function step(now){const t=Math.min(1,(now-begin)/750),e=t*t*(3-2*t);outgoing.material.opacity=1-e;sphere.material.opacity=e;outgoing.position.set(-dx*10000*e,0,-dz*10000*e);sphere.position.set(dx*3500*(1-e),0,dz*3500*(1-e));camera.fov=fov-5*Math.sin(Math.PI*t);camera.updateProjectionMatrix();if(t<1)requestAnimationFrame(step);else resolve()}requestAnimationFrame(step)});camera.fov=fov;camera.updateProjectionMatrix()}
 if(outgoing){scene.remove(outgoing);outgoing.geometry.dispose();outgoing.material.dispose()}sphere.position.set(0,0,0);sphere.material.opacity=1;prefetch();
 }catch(e){$('loading').hidden=false;$('loading').textContent='No se pudo cargar la panorámica. Intenta de nuevo.';console.error(e)}finally{clearTimeout(timer);navigating=false;document.body.classList.remove('travelling')}
}
let refreshingCatalog=false;
async function refreshCatalog(){
 if(navigating||refreshingCatalog)return;
 refreshingCatalog=true;
 const active=stations[index],activeId=active.id;
 try{
  const next=await(await fetch('./catalog.json',{cache:'no-store'})).json();
  const response=await fetch(`./panoramas/${activeId}.json`,{cache:'no-store'});
  const detail=response.ok?await response.json():active;
  // A navigation may finish while either request is in flight.
  if(navigating||stations[index].id!==activeId)return;
  const incoming=next.stations.filter(isViewable).map(s=>({...s,name:`${s.streetName||'Calle por identificar'} · ${s.pk?`PK ${s.pk}`:'PK pendiente'}`}));
  const activeIndex=incoming.findIndex(s=>s.id===activeId);
  if(activeIndex<0)return;
  // Keep the displayed texture, crop and attitude together until replacement loads.
  incoming[activeIndex]={...incoming[activeIndex],geometry:active.geometry,image:active.image};
  stations.splice(0,stations.length,...incoming);index=activeIndex;
  markers.forEach(m=>m.remove());
  markers=stations.map((s,i)=>L.circleMarker([s.lat,s.lon],{pane:'panoramaPoints',radius:i===index?8:5,color:'#cee87b',weight:2,fillColor:i===index?'#d3f76b':'#1a3540',fillOpacity:1}).addTo(map).on('click',()=>selectStation(i)));
  list();$('catalogCount').textContent=`${stations.length} esferas disponibles`;
  $('routeSummary').textContent='Capturas completas · Rumbo contrastado con fotos y GPS';
  $('step').textContent=`${String(index+1).padStart(2,'0')} / ${stations.length}`;
  $('prev').disabled=index===0;$('next').disabled=index===stations.length-1;
  if(detail.image!==active.image||JSON.stringify(detail.geometry)!==JSON.stringify(active.geometry))await selectStation(index,true);
  else project?.selected();
 }catch(e){console.warn('Actualización del recorrido pendiente',e.message)}
 finally{refreshingCatalog=false}
}

function list(){const q=$('search').value.toLowerCase();$('stations').replaceChildren();stations.forEach((s,i)=>{let b=document.createElement('button');b.className='station'+(i===index?' selected':'');b.hidden=!s.name.toLowerCase().includes(q)&&!s.id.includes(q);b.setAttribute('aria-label',s.name);let img=document.createElement('img');img.src=s.thumb;img.alt='';img.loading='lazy';let t=document.createElement('span'),name=document.createElement('strong'),meta=document.createElement('small');name.textContent=s.name;meta.textContent=`${String(i+1).padStart(2,'0')} · ${s.frameCount} tomas${s.partial?' · Parcial':''}${s.geometry?.headingCalibration?' · Rumbo ajustado':''}`;t.append(name,meta);b.append(img,t);b.onclick=()=>selectStation(i);$('stations').append(b)});}

async function init(){inventory=await(await fetch('./inventory.json')).json();catalog=await(await fetch('./catalog.json')).json();stations=catalog.stations.filter(isViewable).map(s=>({...s,name:`${s.streetName||'Calle por identificar'} · ${s.pk?`PK ${s.pk}`:'PK pendiente'}`}));if(!stations.length)throw Error('No hay panorámicas disponibles');$('catalogCount').textContent=`${stations.length} esferas disponibles`;$('routeSummary').textContent='Capturas completas · Rumbo contrastado con fotos y GPS';list();scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(70,1,.1,100000);viewer=new THREE.WebGLRenderer({antialias:true});viewer.setPixelRatio(Math.min(devicePixelRatio,2));$('panorama').append(viewer.domElement);const geo=new THREE.SphereGeometry(50000,80,40);geo.scale(-1,1,1);sphere=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffffff}));sphere.rotation.y=-Math.PI/2;scene.add(sphere);new ResizeObserver(resize).observe($('panorama'));resize();let drag=null;$('panorama').onpointerdown=e=>{if(navigating)return;drag=[e.clientX,e.clientY,yaw,pitch];$('panorama').setPointerCapture(e.pointerId)};$('panorama').onpointermove=e=>{if(drag){yaw=drag[2]-(e.clientX-drag[0])*.16;pitch=Math.max(-85,Math.min(75,drag[3]+(e.clientY-drag[1])*.16))}};$('panorama').onpointerup=()=>drag=null;$('panorama').onpointercancel=()=>drag=null;$('panorama').addEventListener('wheel',e=>{e.preventDefault();camera.fov=Math.max(30,Math.min(100,camera.fov+e.deltaY*.03));camera.updateProjectionMatrix()},{passive:false});map=L.map('map',{zoomControl:false}).setView([stations[0].lat,stations[0].lon],15);map.createPane('panoramaPoints');map.getPane('panoramaPoints').style.zIndex='650';L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);markers=stations.map((s,i)=>L.circleMarker([s.lat,s.lon],{pane:'panoramaPoints',radius:5,color:'#cee87b',weight:2,fillColor:'#1a3540',fillOpacity:1}).addTo(map).on('click',()=>selectStation(i)));$('fitMap').onclick=()=>map.fitBounds(stations.map(s=>[s.lat,s.lon]),{padding:[20,20]});$('prev').onclick=()=>selectStation(index-1);$('next').onclick=()=>selectStation(index+1);$('north').onclick=()=>yaw=0;$('zoomIn').onclick=()=>{camera.fov=Math.max(30,camera.fov-10);camera.updateProjectionMatrix()};$('zoomOut').onclick=()=>{camera.fov=Math.min(100,camera.fov+10);camera.updateProjectionMatrix()};$('search').oninput=list;$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('workspace').requestFullscreen()}catch{project?.toast('Pantalla completa no disponible en este navegador')}};$('help').onclick=()=>$('helpDialog').showModal();document.querySelector('.close-dialog').onclick=()=>$('helpDialog').close();
const view={stations,scene,sphere,camera,map,station:()=>stations[index],select:selectStation,look:(y,p)=>{yaw=y;pitch=p},size:()=>$('panorama').getBoundingClientRect()};project=setupProject(view);
$('panorama').onkeydown=e=>{if(navigating)return;if(e.key==='ArrowLeft')yaw-=6;else if(e.key==='ArrowRight')yaw+=6;else if(e.key==='ArrowUp')pitch=Math.min(75,pitch+6);else if(e.key==='ArrowDown')pitch=Math.max(-85,pitch-6);else if(e.key==='PageDown')selectStation(index+1);else if(e.key==='PageUp')selectStation(index-1);else return;e.preventDefault()};
const requested=stations.findIndex(s=>s.id===location.hash.slice(1));await selectStation(requested>=0?requested:stations.findIndex(s=>!s.partial));;animate()}
init().catch(e=>{$('loading').textContent='No se pudo iniciar Railview: '+e.message;console.error(e)});
