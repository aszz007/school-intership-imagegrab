// Production gallery.js runs unchanged in this DOM/Chrome API adapter.
// These are controlled behavior tests, not real Chrome extension acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../gallery.js',import.meta.url),'utf8');
const core=await readFile(new URL('../shared/core.js',import.meta.url),'utf8');
const html=await readFile(new URL('../gallery.html',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}throw Error('Gallery did not reach expected state');}
function gate(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
class Element{
  constructor(tag){this.tag=tag;this.children=[];this.events=new Map();this.disabled=false;this.hidden=false;this.checked=false;this._text='';const classes=new Set();this.classList={toggle:(key,on)=>on?classes.add(key):classes.delete(key),contains:key=>classes.has(key)};}
  set textContent(text){this._text=String(text);this.children=[];}
  get textContent(){return this._text+this.children.map(x=>x.textContent||'').join('');}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this._text='';this.children=[...nodes];}
  setAttribute(key,value){this[key]=value;}
  addEventListener(type,fn){this.events.set(type,fn);}
  fire(type){return this.events.get(type)?.({target:this,preventDefault(){}});}
  focus(){this.focused=true;}
  remove(){}
}
function gallery({count=5,sizes,urls,bitmapSize=[600,600],permission=true,fetchImage,download,queriedState='in_progress',queryFails=false}={}){
  const nodes=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,new Element('div')]));
  nodes['filter-width'].value='100';nodes['filter-height'].value='100';
  const calls={fetch:[],download:[],permissions:[],search:[]};let changed;let serial=0;
  const entries=Array.from({length:count},(_,i)=>({url:urls?.[i]??'https://img.alicdn.com/'+i+'.jpg',width:sizes?.[i]?.[0]??600,height:sizes?.[i]?.[1]??600}));
  const context={URL,URLSearchParams,Uint8Array,Blob,console,
    location:{protocol:'chrome-extension:',search:'?session=test'},
    document:{getElementById:id=>nodes[id],createElement:tag=>{const el=new Element(tag);if(tag==='canvas'){el.getContext=()=>({drawImage(){}});el.toBlob=cb=>cb(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}));}return el;},body:new Element('body')},
    createImageBitmap:async()=>({width:bitmapSize[0],height:bitmapSize[1],close(){}}),
    FileReader:class{readAsDataURL(){this.result='data:image/png;base64,iVBORw0KGgo=';queueMicrotask(()=>this.onload());}},
    atob:value=>Buffer.from(value,'base64').toString('binary'),
    chrome:{runtime:{id:'controlled-adapter',sendMessage:async message=>{
      if(message.type==='GET_SESSION')return {ok:true,title:'Controlled fixtures',images:entries};
      if(message.type==='FETCH_IMAGE'){calls.fetch.push(message.url);if(fetchImage)await fetchImage(message.url,calls.fetch.length);return {ok:true,mime:'image/png',data:'iVBORw0KGgo='};}
      if(message.type==='DOWNLOAD_PNG'){const id=++serial;calls.download.push(message);if(download)await download(id,delta=>changed(delta));return {ok:true,downloadId:id};}
      throw Error('Unexpected message: '+message.type);
    }},permissions:{request:async query=>{calls.permissions.push(query);return permission;}},downloads:{onChanged:{addListener:fn=>changed=fn},search:async query=>{calls.search.push(query);if(queryFails)throw Error('controlled search failure');return [{id:query.id,state:queriedState}];}}}
  };
  vm.createContext(context);vm.runInContext(core,context);vm.runInContext(code,context);
  return {nodes,calls,changed:delta=>changed(delta),ready:()=>until(()=>nodes.total.textContent===String(count)),click:id=>nodes[id].fire('click'),tile:i=>nodes.gallery.children[i].children.at(-1),
    filter:(width,height)=>{nodes['filter-width'].value=String(width);nodes['filter-height'].value=String(height);nodes['dimension-filter'].fire('submit');},
    preview:(i,width,height)=>{const img=nodes.gallery.children[i].children[0].children[0].children[1];img.naturalWidth=width;img.naturalHeight=height;img.fire('load');},
    previewError:i=>nodes.gallery.children[i].children[0].children[0].children[1].fire('error')};
}
test('Gallery batch uses two workers and schedules each selected item once',async()=>{
  const first=gate(),second=gate();const g=gallery({fetchImage:async(_url,n)=>{if(n===1)await first.promise;if(n===2)await second.promise;}});await g.ready();
  const task=g.click('download');await until(()=>g.calls.fetch.length===2);assert.equal(g.calls.download.length,0);assert.equal(g.nodes.download.disabled,true);
  first.resolve();second.resolve();await task;assert.equal(g.calls.fetch.length,5);assert.equal(g.calls.download.length,5);assert.equal(new Set(g.calls.fetch).size,5);assert.equal(g.nodes['progress-bar'].value,5);assert.equal(g.nodes.download.disabled,false);
});
test('Stopping a gallery batch does not schedule queued items or download in-flight conversions',async()=>{
  const held=gate();const g=gallery({fetchImage:()=>held.promise});await g.ready();const task=g.click('download');await until(()=>g.calls.fetch.length===2);g.click('cancel');held.resolve();await task;
  assert.equal(g.calls.fetch.length,2);assert.equal(g.calls.download.length,0);assert.match(g.nodes.notice.textContent,/已停止/);assert.equal(g.nodes.download.disabled,false);
});
test('Refusing image permissions produces no fetch/download and permits retry',async()=>{
  const g=gallery({permission:false});await g.ready();await g.click('download');assert.equal(g.calls.fetch.length,0);assert.equal(g.calls.download.length,0);assert.match(g.nodes.notice.textContent,/没有获得图片源权限/);assert.equal(g.nodes.download.disabled,false);
});
test('One source failure leaves other items running and a later retry succeeds',async()=>{
  let fail=true;const g=gallery({count:3,fetchImage:async url=>{if(fail&&url.endsWith('/0.jpg'))throw Error('controlled source failure');}});await g.ready();await g.click('download');assert.equal(g.calls.download.length,2);assert.match(g.nodes.notice.textContent,/失败 1/);assert.equal(g.nodes.download.disabled,false);
  fail=false;await g.click('download');assert.equal(g.calls.download.length,5);assert.match(g.nodes.notice.textContent,/失败 0/);assert.equal(g.nodes['result-list'].children.filter(x=>/controlled/.test(x.textContent)).length,0);
});
test('Gallery selection controls determine the exact batch and disable empty download',async()=>{
  const g=gallery({count:3});await g.ready();g.click('clear');assert.equal(g.nodes.selected.textContent,'0');assert.equal(g.nodes.download.disabled,true);g.click('invert');assert.equal(g.nodes.selected.textContent,'3');await g.click('download');assert.equal(g.calls.download.length,3);
});
test('Browser interruption is reported without claiming a saved file',async()=>{
  const g=gallery({count:1});await g.ready();await g.click('download');g.changed({id:1,state:{current:'interrupted'}});assert.match(g.tile(0).textContent,/中断/);assert.doesNotMatch(g.tile(0).textContent,/确认下载完成/);
});
test('A completion received before the download reply is recovered by an exact ID query',async()=>{
  const g=gallery({count:1,queriedState:'complete',download:async(id,emit)=>emit({id,state:{current:'complete'}})});await g.ready();await g.click('download');assert.match(g.tile(0).textContent,/浏览器确认下载完成/);assert.deepEqual(g.calls.search.map(x=>x.id),[1]);
});
test('Status query failure does not retry or misreport a successful download request',async()=>{
  const g=gallery({count:1,queryFails:true});await g.ready();await g.click('download');assert.equal(g.calls.download.length,1);assert.match(g.nodes.notice.textContent,/已发起 1.*失败 0/);assert.match(g.nodes['result-list'].textContent,/状态暂时无法确认/);g.changed({id:1,state:{current:'complete'}});assert.match(g.tile(0).textContent,/确认下载完成/);
});
test('Width and height jointly limit selection, permission requests and download queue',async()=>{
  const g=gallery({count:3,sizes:[[600,600],[800,400],[1200,1000]],urls:['https://img.alicdn.com/0.jpg','https://img.jd.com/1.jpg','https://img.pddpic.com/2.jpg'],bitmapSize:[1200,1000]});await g.ready();g.filter(700,500);
  assert.equal(g.nodes.total.textContent,'1');assert.equal(g.nodes.selected.textContent,'1');assert.deepEqual(g.nodes.gallery.children.map(x=>x.hidden),[true,true,false]);
  g.click('invert');assert.equal(g.nodes.selected.textContent,'0');g.click('select-all');assert.equal(g.nodes.selected.textContent,'1');await g.click('download');
  assert.deepEqual(g.calls.fetch,['https://img.pddpic.com/2.jpg']);assert.equal(g.calls.download.length,1);assert.equal(g.calls.permissions.length,1);assert.deepEqual([...g.calls.permissions[0].origins],['https://img.pddpic.com/*']);
});
test('Invalid dimensions retain the applied filter and focus the invalid field',async()=>{
  const g=gallery({count:1});await g.ready();g.filter(500,500);
  for(const value of ['99','100.5','','16385','abc']){g.filter(value,500);assert.match(g.nodes['filter-error'].textContent,/100—16384/);assert.equal(g.nodes.total.textContent,'1');assert.equal(g.nodes.selected.textContent,'1');assert.equal(g.nodes['filter-width'].focused,true);}
  g.filter(500,99);assert.equal(g.nodes['filter-height'].focused,true);g.filter(600,600);assert.equal(g.nodes['filter-error'].textContent,'');assert.equal(g.nodes.total.textContent,'1');
});
test('Empty results show criteria and reset restores images without silently selecting them',async()=>{
  const g=gallery({count:3});await g.ready();g.filter(1000,800);assert.equal(g.nodes.total.textContent,'0');assert.equal(g.nodes.empty.hidden,false);assert.equal(g.nodes.download.disabled,true);assert.equal(g.nodes['reset-empty'].hidden,false);assert.match(g.nodes['empty-help'].textContent,/1000 × 800/);
  g.click('select-all');assert.equal(g.nodes.selected.textContent,'0');g.click('reset-empty');assert.equal(g.nodes.total.textContent,'3');assert.equal(g.nodes.selected.textContent,'0');assert.equal(g.nodes.empty.hidden,true);assert.equal(g.nodes['filter-width'].value,'100');assert.equal(g.nodes['filter-width'].focused,true);g.click('select-all');assert.equal(g.nodes.selected.textContent,'3');
});
test('Unknown dimensions remain previewable and become selectable only after matching load',async()=>{
  const g=gallery({count:1,sizes:[[0,0]]});await g.ready();g.filter(700,500);const tile=g.nodes.gallery.children[0];
  assert.equal(g.nodes.total.textContent,'0');assert.equal(g.nodes.empty.hidden,true);assert.equal(tile.hidden,false);assert.equal(tile.children[0].children[0].children[0].disabled,true);assert.match(g.nodes['filter-summary'].textContent,/1 张尺寸待确认/);
  g.preview(0,1200,900);assert.equal(g.nodes.total.textContent,'1');assert.equal(g.nodes.selected.textContent,'0');g.click('select-all');assert.equal(g.nodes.selected.textContent,'1');
});
test('Preview failures resolve pending dimensions into an actionable empty result',async()=>{
  const g=gallery({count:1,sizes:[[0,0]]});await g.ready();g.filter(700,500);g.previewError(0);assert.equal(g.nodes.empty.hidden,false);assert.equal(g.nodes.gallery.children[0].hidden,true);assert.doesNotMatch(g.nodes['filter-summary'].textContent,/待确认/);
  g.click('reset-filter');assert.equal(g.nodes.total.textContent,'1');assert.equal(g.nodes.selected.textContent,'0');
});
test('Filter submission and reset cannot mutate the snapshot while a batch is running',async()=>{
  const held=gate();const g=gallery({count:3,fetchImage:()=>held.promise});await g.ready();g.filter(500,500);const task=g.click('download');await until(()=>g.calls.fetch.length===2);
  for(const id of ['filter-width','filter-height','apply-filter','reset-filter','reset-empty'])assert.equal(g.nodes[id].disabled,true);
  g.filter(1000,1000);g.click('reset-filter');assert.equal(g.nodes.total.textContent,'3');held.resolve();await task;assert.equal(g.calls.download.length,3);assert.equal(g.nodes['apply-filter'].disabled,false);
});
test('PNG conversion rejects actual dimensions below the selected criteria despite larger metadata',async()=>{
  const g=gallery({count:1,sizes:[[1200,1000]],bitmapSize:[600,600]});await g.ready();g.filter(700,500);await g.click('download');assert.equal(g.calls.fetch.length,1);assert.equal(g.calls.download.length,0);assert.match(g.tile(0).textContent,/实际尺寸不符合/);assert.match(g.nodes.notice.textContent,/失败 1/);
});
