export const STORE_APPS={
 amazon:{label:'Amazon Android app',packages:['in.amazon.mShop.android.shopping','com.amazon.mShop.android.shopping']},
 flipkart:{label:'Flipkart Android app',packages:['com.flipkart.android']},
} as const;
export type StoreName=keyof typeof STORE_APPS;
export function nativeStoreForUrl(raw:string):StoreName|undefined{
 try{const host=new URL(raw).hostname.toLowerCase();if(host==='amazon.in'||host.endsWith('.amazon.in')||host==='amazon.com'||host.endsWith('.amazon.com'))return 'amazon';if(host==='flipkart.com'||host.endsWith('.flipkart.com'))return 'flipkart';}catch{}
}
export function nativeStoreForPackage(pkg:string):StoreName|undefined{
 return (Object.keys(STORE_APPS) as StoreName[]).find(store=>(STORE_APPS[store].packages as readonly string[]).includes(pkg));
}
