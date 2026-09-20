const $ = (s) => document.querySelector(s);
const isStaticPages = location.hostname.endsWith('github.io');
const quicks = [
  ['🧴','高级产品海报','一瓶极简护肤精华悬浮在透明水面上，银白色光影，高级商业摄影'],
  ['🐈','奇幻萌宠','戴着宇航员头盔的橘猫漂浮在蓝紫色星云中，电影级光影'],
  ['🏙️','未来城市','雨夜中的未来上海，霓虹灯倒映在街道，赛博朋克电影感'],
  ['🍰','美食摄影','草莓奶油蛋糕放在窗边木桌，柔和晨光，日系杂志摄影'],
];
const styleData = [
  ['真实摄影','linear-gradient(135deg,#54718b,#d8c9b5)'],['电影质感','linear-gradient(135deg,#101820,#ba603a)'],
  ['3D 渲染','linear-gradient(135deg,#6f48e9,#f592c8)'],['国潮插画','linear-gradient(135deg,#cc2936,#f2b84b)'],
  ['日系清新','linear-gradient(135deg,#8ec5a4,#f3d9ca)'],['赛博朋克','linear-gradient(135deg,#152469,#e11dcb)'],
];
let selectedStyle = styleData[0][0];
let selectedSize = '1024x1024';
let files = [];

$('#quickGrid').innerHTML = quicks.map(([i,t])=>`<button type="button" class="quick-card" aria-pressed="false"><span>${i}</span><strong>${t}</strong></button>`).join('');
[...$('#quickGrid').children].forEach((el,i)=>el.onclick=()=>{
  document.querySelectorAll('.quick-card').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false')});
  el.classList.add('selected');el.setAttribute('aria-pressed','true');
  $('#prompt').value=quicks[i][2]; updateCount(); $('#prompt').focus(); toast(`已选择灵感：${quicks[i][1]}`);
});
$('#styles').innerHTML = styleData.map(([name,bg],i)=>`<button type="button" class="style-card ${i?'':'selected'}" aria-pressed="${i?'false':'true'}" style="background:${bg}" data-style="${name}"><span>${name}</span></button>`).join('');
$('#styles').onclick = (e) => {
  const card=e.target.closest('.style-card'); if(!card)return;
  document.querySelectorAll('.style-card').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false')});
  card.classList.add('selected');card.setAttribute('aria-pressed','true');selectedStyle=card.dataset.style;
  $('#selectedStyleText').textContent=selectedStyle; toast(`已选择风格：${selectedStyle}`);
};
$('#sizes').onclick=(e)=>{if(!e.target.dataset.size)return;document.querySelectorAll('#sizes button').forEach(x=>x.classList.remove('selected'));e.target.classList.add('selected');selectedSize=e.target.dataset.size};
function updateCount(){ $('#charCount').textContent=$('#prompt').value.length }
$('#prompt').addEventListener('input',updateCount);

$('#fileInput').onchange = (e) => {
  files = [...e.target.files].slice(0,4);
  $('#previewList').innerHTML='';
  files.forEach(file=>{const img=document.createElement('img');img.className='preview';img.src=URL.createObjectURL(file);$('#previewList').appendChild(img)});
};

function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove('show'),3000)}
function getImage(item){if(item.url)return item.url;if(item.b64_json)return `data:image/png;base64,${item.b64_json}`;return ''}
async function checkStatus(){
  if(isStaticPages){
    $('#statusDot').className='status-dot';$('#statusText').textContent='静态演示版';
    $('#model').innerHTML='<option value="gpt-image-2.5">gpt-image-2.5（推荐）</option><option value="gpt-image-2.5-flare">gpt-image-2.5-flare</option><option value="gpt-image-2">gpt-image-2</option><option value="image2">image2</option><option value="nano_banana_2">nano_banana_2（参考图）</option>';
    return;
  }
  try{const data=await fetch('/api/status').then(r=>r.json());$('#statusDot').className=`status-dot ${data.configured?'ok':'bad'}`;$('#statusText').textContent=data.configured?'接口已连接':'待填写密钥';if(data.configured)await loadModels()}catch{$('#statusDot').className='status-dot bad';$('#statusText').textContent='服务异常'}
}
async function loadModels(){
  try{
    const response=await fetch('/api/models');const data=await response.json();
    if(!response.ok)throw new Error(data.error?.message||'模型读取失败');
    const models=data.data||[];if(!models.length)return;
    const recommended=models.find(x=>x.id==='gpt-image-2.5')||models[0];
    $('#model').innerHTML=models.map(x=>`<option value="${x.id}" ${x.id===recommended.id?'selected':''}>${x.id}${x.supportsVision?'（支持参考图）':''}</option>`).join('');
  }catch(error){toast(error.message)}
}

$('#generate').onclick=async()=>{
  if(isStaticPages)return toast('GitHub Pages 是静态演示版；生图功能需要单独部署 Node.js 后端');
  const raw=$('#prompt').value.trim();
  if(!raw)return toast('先描述一下你想要的画面');
  const prompt=`${raw}\n视觉风格：${selectedStyle}。画面完整，构图精致，高质量。`;
  const count=Number($('#count').value);
  $('#results').classList.remove('hidden');
  $('#resultGrid').innerHTML=Array.from({length:count},()=>'<div class="result-card"><div class="loader">✦ AI 正在绘制...</div></div>').join('');
  $('#resultMeta').textContent=`${selectedStyle} · ${selectedSize} · ${count} 张`;
  $('#generate').disabled=true;$('#generate').innerHTML='<span>✦</span> 生成中...';
  $('#results').scrollIntoView({behavior:'smooth',block:'start'});
  try{
    let response;
    if(files.length){const form=new FormData();form.append('prompt',prompt);form.append('size',selectedSize);form.append('quality',$('#quality').value);form.append('model','nano_banana_2');files.forEach(f=>form.append('image',f));response=await fetch('/api/images/edits',{method:'POST',body:form})}
    else response=await fetch('/api/images/generations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:$('#model').value,prompt,size:selectedSize,quality:$('#quality').value,n:count})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error?.message||`生成失败（${response.status}）`);
    const images=(data.data||data.images||[]).map(getImage).filter(Boolean);
    if(!images.length)throw new Error('接口已返回，但没有找到图片数据');
    $('#resultGrid').innerHTML=images.map((src,i)=>`<article class="result-card"><img src="${src}" alt="AI 生成图 ${i+1}"><div class="result-actions"><span>作品 ${i+1}</span><a href="${src}" download="星图AI-${Date.now()}-${i+1}.png">⬇ 下载原图</a></div></article>`).join('');
    const drafts=Number(localStorage.getItem('draftCount')||0)+images.length;localStorage.setItem('draftCount',drafts);$('#draftCount').textContent=drafts;toast('图片生成完成');
  }catch(error){$('#resultGrid').innerHTML=`<div class="result-card"><div class="loader" style="animation:none;color:#d74c5b">${error.message}</div></div>`;toast(error.message)}
  finally{$('#generate').disabled=false;$('#generate').innerHTML='<span>✦</span> 立即生成'}
};
$('#clearResults').onclick=()=>{$('#results').classList.add('hidden');$('#resultGrid').innerHTML=''};
$('#newTask').onclick=()=>{$('#prompt').value='';files=[];$('#previewList').innerHTML='';$('#fileInput').value='';updateCount();$('#clearResults').click();toast('已新建空白任务')};
$('#draftCount').textContent=localStorage.getItem('draftCount')||0;
checkStatus();
