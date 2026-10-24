/* Builds supabase/setup.sql = setup.head.sql + your current products from shop-data.js */
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'); const sb={window:{}}; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(root,'shop-data.js'),'utf8'),sb);
const q=s=>"'"+String(s==null?'':s).replace(/'/g,"''")+"'";
const rows=sb.window.GT_DATA.products.map((p,i)=>`  (${q(p.id)}, ${q(p.brand)}, ${q(p.name)}, ${q(p.short)}, ${q(p.desc)}, ${q(JSON.stringify(p.details||[]))}::jsonb, ${p.price}, ${q(p.img)}, ${p.customize?q(JSON.stringify(p.customize))+'::jsonb':'null'}, true, ${(i+1)*10})`);
const seed=`insert into public.products (id, brand, name, short, description, details, price, image_url, customize, active, sort_order) values\n${rows.join(',\n')}\non conflict (id) do nothing;\n`;
fs.writeFileSync(path.join(root,'supabase','setup.sql'),fs.readFileSync(path.join(root,'supabase','setup.head.sql'),'utf8')+seed);
console.log('supabase/setup.sql written, products:',rows.length);
