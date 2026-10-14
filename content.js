/* 只读取当前页面已经加载的内容，不滚动页面、不调用商家后台API。 */
(function () {
  'use strict';
  if(globalThis.__imagegrabLoaded)return;
  globalThis.__imagegrabLoaded=true;
  const core=ImageGrabCore;
  function collect() {return core.mergeCandidates(ImageGrabExtract.collect(document,location.href),location.href);}
  async function openGallery() {
    const images=collect();
    if(!images.length)throw new Error('未找到符合条件的图片。请等图片加载后再次获取。');
    const response=await chrome.runtime.sendMessage({type:'OPEN_GALLERY',images,title:document.title.slice(0,120)});
    if(!response?.ok)throw new Error(response?.error||'无法打开图片画廊');
    return response;
  }
  chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
    if(message?.type==='COLLECT_PAGE') {
      if(!core.shopURL(location.href)){reply({ok:false,error:'请打开淘宝/天猫、京东或拼多多的商品页面。'});return false;}
      openGallery().then(reply).catch(error=>reply({ok:false,error:error.message}));return true;
    }
    return false;
  });
  function addButton() {
    if(!core.productURL(location.href) || document.getElementById('imagegrab-floating-button'))return;
    const button=document.createElement('button');button.id='imagegrab-floating-button';button.type='button';button.textContent='获取图片';button.setAttribute('aria-label','用图提取插件获取当前商品页图片');
    const notice=document.createElement('div');notice.id='imagegrab-page-notice';notice.setAttribute('role','status');notice.hidden=true;
    button.addEventListener('click',async()=>{button.disabled=true;button.textContent='正在获取…';notice.hidden=true;try{await openGallery();}catch(error){notice.textContent=error.message;notice.hidden=false;}finally{button.disabled=false;button.textContent='获取图片';}});
    document.body.append(button,notice);
  }
  if(document.body)addButton();else document.addEventListener('DOMContentLoaded',addButton,{once:true});
})();
