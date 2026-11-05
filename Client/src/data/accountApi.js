const host = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
const defaultOrigin = `http://${host}:3001`;
const base = (process.env.REACT_APP_API_URL || defaultOrigin).replace(/\/$/, '');
export async function accountRequest(path, options={}) {
  let response;
  try {response=await fetch(`${base}${path}`,{credentials:'include',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});}
  catch {throw new Error('Account server is unavailable. You can still play locally.');}
  let body={};try {body=await response.json();} catch {}
  if(!response.ok) {const error=new Error(body.error || 'Something went wrong. Please try again.');error.status=response.status;throw error;}
  return body;
}
