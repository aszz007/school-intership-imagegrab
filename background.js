importScripts('shared/core.js');
const core=ImageGrabCore;
const sessions=chrome.storage.session || chrome.storage.local;
const SESSION_PREFIX='imagegrab-session-';
async function pruneSessions() {
  const values=await sessions.get(null);
  const expired=Object.entries(values).filter(([key,value])=>key.startsWith(SESSION_PREFIX) && (!value?.createdAt || Date.now()-value.createdAt>2*60*60*1000)).map(([key])=>key);
  if(expired.length)await sessions.remove(expired);
  const valid=Object.entries(values).filter(([key])=>key.startsWith(SESSION_PREFIX)&&!expired.includes(key)).sort((a,b)=>a[1].createdAt-b[1].createdAt);
  if(valid.length>=8)await sessions.remove(valid.slice(0,valid.length-7).map(([key])=>key));
}
function extensionSender(sender){return sender.id===chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL(''));}
function base64(bytes){let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);}
async function fetchImage(url) {
  if(!core.allowedImageURL(url))throw new Error('暂不支持该图片域名，请使用支持的商品图片源。');
  const origin=core.originPattern(url);
  if(!await chrome.permissions.contains({origins:[origin]}))throw new Error('图片源未授权，请确认下载权限后重试。');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(url,{credentials:'omit',redirect:'error',signal:controller.signal});
    if(!response.ok)throw new Error('图片请求失败（HTTP '+response.status+'）');
    const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!type.startsWith('image/'))throw new Error('返回内容不是图片');
    if(Number(response.headers.get('content-length'))>core.MAX_BYTES)throw new Error('图片超过12MB限制');
    const reader=response.body.getReader();let length=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>core.MAX_BYTES){await reader.cancel();throw new Error('图片超过12MB限制');}chunks.push(value);}
    if(!length)throw new Error('图片文件为空');
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return {ok:true,data:base64(bytes),mime:type};
  } catch(error){if(error.name==='AbortError')throw new Error('图片请求超时，请稍后重试');throw error;}finally{clearTimeout(timer);}
}
async function handle(message,sender) {
  if(message?.type==='OPEN_GALLERY') {
    if(sender.id!==chrome.runtime.id || !sender.tab || !core.shopURL(sender.tab.url))throw new Error('仅允许当前商品页面打开画廊');
    if(!Array.isArray(message.images))throw new Error('图片数据格式无效');
    const images=core.mergeCandidates(message.images,sender.tab.url);
    if(!images.length)throw new Error('没有符合条件的图片');
    await pruneSessions();
    const id=crypto.randomUUID();const key=SESSION_PREFIX+id;
    await sessions.set({[key]:{images,title:String(message.title||'商品图片').slice(0,120),createdAt:Date.now()}});
    await chrome.tabs.create({url:chrome.runtime.getURL('gallery.html?session='+id)});
    return {ok:true};
  }
  if(!extensionSender(sender))throw new Error('仅允许扩展内部页面访问');
  if(message?.type==='GET_SESSION') {
    if(!/^[0-9a-f-]{36}$/.test(String(message.id||'')))throw new Error('画廊地址无效');
    const key=SESSION_PREFIX+message.id;const result=await sessions.get(key);const data=result[key];
    if(!data || Date.now()-data.createdAt>2*60*60*1000)throw new Error('画廊已过期，请回到商品页重新获取图片');
    return {ok:true,...data};
  }
  if(message?.type==='FETCH_IMAGE')return fetchImage(String(message.url));
  if(message?.type==='DOWNLOAD_PNG') {
    if(typeof message.data!=='string' || !message.data.startsWith('data:image/png;base64,') || message.data.length>core.MAX_BYTES*1.5)throw new Error('PNG下载数据无效或过大');
    let prefix;try{prefix=Uint8Array.from(atob(message.data.slice(22,34)),c=>c.charCodeAt(0));}catch{throw new Error('PNG编码无效');}
    if(!core.isPNG(prefix))throw new Error('图片未正确转换为PNG');
    const id=await chrome.downloads.download({url:message.data,filename:core.filename(message.index),conflictAction:'uniquify',saveAs:false});
    return {ok:true,downloadId:id};
  }
  throw new Error('不支持的操作');
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{handle(message,sender).then(reply).catch(error=>reply({ok:false,error:error.message}));return true;});
