const FOLDER='1nqzbzyvLv-_qW4CGmAKZJpxU3mxYk6ep';
export async function onRequestGet({env,params}){
 const match=/^([A-Za-z0-9_-]{15,})\.pdf$/.exec(params.id||'');
 if(!match)return new Response('Invalid file',{status:400});
 if(!env.GOOGLE_DRIVE_API_KEY)return new Response('Google Drive API is not configured',{status:503});
 const id=match[1],key=env.GOOGLE_DRIVE_API_KEY;
 const meta=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?'+new URLSearchParams({fields:'id,mimeType,parents,trashed',key}));
 if(!meta.ok)return new Response('File unavailable',{status:meta.status});
 const file=await meta.json();
 if(file.trashed||file.mimeType!=='application/pdf'||!file.parents?.includes(FOLDER))return new Response('Not in the church score folder',{status:403});
 const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?'+new URLSearchParams({alt:'media',key}));
 if(!response.ok)return new Response('PDF unavailable',{status:response.status});
 return new Response(response.body,{headers:{'content-type':'application/pdf','content-disposition':'inline','cache-control':'public,max-age=600','x-content-type-options':'nosniff'}});
}
