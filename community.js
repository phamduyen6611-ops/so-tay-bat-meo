(() => {
 'use strict';
 const dialog=document.createElement('dialog');dialog.className='community-dialog';
 dialog.setAttribute('aria-labelledby','communityTitle');
 dialog.innerHTML='<div class="community-heading"><h2 id="communityTitle">Bình luận</h2><button type="button" aria-label="Đóng bình luận" id="communityClose">×</button></div><p class="community-notice">Tên hiển thị và bình luận là công khai. Không chia sẻ số điện thoại, email hoặc thông tin riêng tư.</p><p class="community-status" role="status" aria-live="polite"></p><div class="community-toolbar"></div><form class="community-form"><label>Tên hiển thị<input maxlength="40" required autocomplete="nickname"></label><label>Bình luận<textarea maxlength="1500" required></textarea></label><p class="community-reply-to" hidden></p><div class="community-actions"><button type="submit">Gửi bình luận</button><button type="button" class="community-cancel-reply" hidden>Hủy trả lời</button></div></form><div class="community-list"></div><button type="button" class="community-more" hidden>Xem thêm bình luận</button>';
 document.body.append(dialog);
 const q=s=>dialog.querySelector(s),form=q('form'),name=q('input'),body=q('textarea'),status=q('[role=status]'),list=q('.community-list'),more=q('.community-more'),toolbar=q('.community-toolbar');
 let cat=null,mode='comments',busy=false,version=0,limit=50,parent=null,rows=[],opener=null;
 const client=()=>supabaseClient;
 const user=()=>currentUser;
 const admin=()=>Boolean(currentUser && isCatAdmin);
 const fail=e=>{status.textContent=/42P01|PGRST205/.test(e?.code||'')?'Tính năng bình luận đang được chuẩn bị. Vui lòng quay lại sau.':(e?.message||'Chưa kết nối được. Hãy thử tải lại.');};
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 function button(label,fn){const b=node('button',label);b.type='button';b.disabled=busy;b.addEventListener('click',()=>run(fn));return b;}
 async function run(fn){if(busy)return;busy=true;dialog.querySelectorAll('button').forEach(b=>{if(b.id!=='communityClose')b.disabled=true;});try{await fn();}catch(e){fail(e);}finally{busy=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 function requireUser(){if(!user())throw Error('Bạn cần đăng nhập để bình luận, trả lời hoặc báo cáo.');return user().id;}
 function cancelReply(){parent=null;q('.community-reply-to').hidden=true;q('.community-cancel-reply').hidden=true;}
 function reply(row){requireUser();parent=row.parent_id||row.id;q('.community-reply-to').textContent='Đang trả lời '+(row.author?.display_name||'Người dùng');q('.community-reply-to').hidden=false;q('.community-cancel-reply').hidden=false;body.focus();}
 async function remove(row){requireUser();if(!confirm('Xóa bình luận này? Các câu trả lời được giữ lại.'))return;const r=await client().from('cat_comments').delete().eq('id',row.id);if(r.error)throw r.error;await load();}
 function renderComment(row,isReply=false){
  const article=node('article');article.className='community-comment'+(isReply?' community-reply':'');
  article.append(node('strong',row.author?.display_name||'Người dùng'),node('small',new Date(row.created_at).toLocaleString('vi-VN')+(row.updated_at!==row.created_at?' · đã chỉnh sửa':'')),node('p',row.body));
  const actions=node('div');actions.className='community-actions';
  if(user()&&mode==='comments')actions.append(button('Trả lời',()=>reply(row)));
  if(user()?.id===row.author_id)actions.append(button('Sửa',async()=>{const value=prompt('Sửa bình luận (tối đa 1.500 ký tự)',row.body);if(value===null)return;if(!value.trim()||value.trim().length>1500)throw Error('Bình luận cần từ 1 đến 1.500 ký tự.');const r=await client().from('cat_comments').update({body:value.trim()}).eq('id',row.id).eq('author_id',requireUser());if(r.error)throw r.error;await load();}));
  if(user()?.id===row.author_id||admin())actions.append(button('Xóa',()=>remove(row)));
  if(user()&&user().id!==row.author_id)actions.append(button('Báo cáo',async()=>{const reason=prompt('Lý do báo cáo (tối đa 500 ký tự)');if(reason===null)return;if(!reason.trim()||reason.trim().length>500)throw Error('Hãy nhập lý do từ 1 đến 500 ký tự.');const r=await client().from('cat_comment_reports').insert({comment_id:row.id,reporter_id:requireUser(),reason:reason.trim()});if(r.error){if(r.error.code==='23505')throw Error('Bạn đã báo cáo bình luận này.');throw r.error;}status.textContent='Đã gửi báo cáo tới admin.';}));
  article.append(actions);return article;
 }
 async function load(){
  const token=++version;status.textContent='Đang tải…';form.hidden=mode!=='comments'||!user();more.hidden=true;toolbar.replaceChildren();
  if(mode==='comments')toolbar.append(button('Tải lại',load));
  if(!client())throw Error('Chưa kết nối được dữ liệu.');
  if(mode==='reports'){
   if(!admin())throw Error('Chỉ admin được xem báo cáo.');
   const r=await client().from('cat_comment_reports').select('id,reason,created_at,comment:cat_comments(id,cat_id,body,author_id,parent_id,created_at,updated_at,author:cat_profiles(display_name))').order('created_at',{ascending:false}).limit(100);
   if(token!==version||!dialog.open||!admin())return;if(r.error)throw r.error;list.replaceChildren();
   for(const report of r.data){const entry=node('section');entry.append(node('p','Lý do: '+report.reason));if(report.comment)entry.append(renderComment(report.comment));entry.append(button('Bỏ báo cáo',async()=>{if(!admin())throw Error('Bạn không còn quyền admin.');const d=await client().from('cat_comment_reports').delete().eq('id',report.id);if(d.error)throw d.error;await load();}));list.append(entry);}
   status.textContent=r.data.length?'Báo cáo gần đây (tối đa 100).':'Chưa có báo cáo.';return;
  }
  const r=await client().from('cat_comments').select('id,cat_id,author_id,parent_id,body,created_at,updated_at,author:cat_profiles(display_name)').eq('cat_id',cat.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(limit+1);
  if(token!==version||!dialog.open)return;if(r.error)throw r.error;rows=r.data.slice(0,limit).reverse();list.replaceChildren();
  const ids=new Set(rows.map(row=>row.id));
  for(const row of rows.filter(row=>!row.parent_id||!ids.has(row.parent_id))){list.append(renderComment(row));for(const child of rows.filter(c=>c.parent_id===row.id))list.append(renderComment(child,true));}
  more.hidden=r.data.length<=limit;status.textContent=rows.length?('Đang hiển thị '+rows.length+' bình luận gần đây.'): 'Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện!';
  if(!user()){toolbar.append(button('Đăng nhập để bình luận',()=>{dialog.close();document.getElementById('openModalBtn').click();}));return;}
  const uid=user().id;const p=await client().from('cat_profiles').select('display_name').eq('id',uid).maybeSingle();
  if(token!==version||user()?.id!==uid)return;if(p.error)throw p.error;name.value=p.data?.display_name||(typeof getDisplayName==='function'?getDisplayName():'');
 }
 form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
  const uid=requireUser(),text=body.value.trim(),display=name.value.trim();if(!display||display.length>40||!text||text.length>1500)throw Error('Điền tên hiển thị và bình luận hợp lệ.');
  const targetCat=cat.id,targetParent=parent;
  const p=await client().from('cat_profiles').upsert({id:uid,display_name:display},{onConflict:'id'});if(p.error)throw p.error;
  if(user()?.id!==uid)throw Error('Tài khoản đã thay đổi. Hãy đăng nhập lại.');
  const r=await client().from('cat_comments').insert({cat_id:targetCat,author_id:uid,parent_id:targetParent,body:text});if(r.error)throw r.error;
  body.value='';cancelReply();await load();status.textContent='Đã gửi bình luận.';
 });});
 q('#communityClose').onclick=()=>dialog.close();q('.community-cancel-reply').onclick=cancelReply;more.onclick=()=>{limit+=50;run(load);};
 dialog.addEventListener('close',()=>{version++;list.replaceChildren();body.value='';cancelReply();opener?.focus({preventScroll:true});});
 if(client())client().auth.onAuthStateChange(event=>{if(['SIGNED_OUT','USER_DELETED','SIGNED_IN','USER_UPDATED'].includes(event)){version++;if(dialog.open)dialog.close();}});
 window.catCommunity={open:async(value,reports=false)=>{if(busy)return;opener=document.activeElement;cat=value;mode=reports?'reports':'comments';limit=50;cancelReply();q('#communityTitle').textContent=reports?'Bình luận bị báo cáo':'Bình luận · '+(cat.name||'Mèo chưa đặt tên');list.replaceChildren();dialog.showModal();run(load);}};
})();
